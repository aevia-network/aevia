package rotate_test

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient/simulated"

	"github.com/Leeaandrob/aevia/services/coordinator/internal/rotate"
)

// --- Encoder round-trip (no chain needed) ---

func TestEncodeSetCoordinatorRoundTrip(t *testing.T) {
	var addr [20]byte
	copy(addr[:], bytes.Repeat([]byte{0xAB}, 20))

	data, err := rotate.EncodeSetCoordinator(addr)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if len(data) != 4+32 {
		t.Fatalf("len = %d, want 36", len(data))
	}
	decoded, err := rotate.DecodeSetCoordinator(data)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if decoded != addr {
		t.Fatalf("round-trip mismatch: got %x want %x", decoded, addr)
	}
}

func TestSetCoordinatorSelectorIsPinned(t *testing.T) {
	// keccak256("setCoordinator(address)")[:4] pinned — drift fails loudly.
	want := "8ea98117"
	if got := rotate.SelectorHex(); got != want {
		t.Fatalf("selector = %s, want %s (the Solidity signature changed)", got, want)
	}
}

func TestDecodeSetCoordinatorRejectsWrongSelector(t *testing.T) {
	bad := make([]byte, 4+32)
	bad[0] = 0x12
	if _, err := rotate.DecodeSetCoordinator(bad); err == nil {
		t.Fatal("accepted wrong selector")
	}
}

// --- Simulated-backend integration against real PersistencePool bytecode ---

type forgeArtifact struct {
	Bytecode struct {
		Object string `json:"object"`
	} `json:"bytecode"`
}

func loadPersistencePoolBytecode(t *testing.T) []byte {
	t.Helper()
	path := filepath.Join("..", "..", "..", "..", "packages", "contracts", "out", "PersistencePool.sol", "PersistencePool.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("forge artifact not available (run `forge build` in packages/contracts first): %v", err)
	}
	var art forgeArtifact
	if err := json.Unmarshal(raw, &art); err != nil {
		t.Fatalf("parse forge artifact: %v", err)
	}
	code := art.Bytecode.Object
	if len(code) == 0 {
		t.Fatal("forge artifact has empty bytecode")
	}
	if len(code) >= 2 && code[:2] == "0x" {
		code = code[2:]
	}
	b, err := hex.DecodeString(code)
	if err != nil {
		t.Fatalf("decode bytecode: %v", err)
	}
	return b
}

func padAddrWord(a common.Address) []byte {
	w := make([]byte, 32)
	copy(w[12:], a.Bytes())
	return w
}

// signAndSend uses the raw private key to sign tx, broadcasts, and mines
// one block. Tolerates revert errors from SendTransaction (they surface
// synchronously from the simulated backend) by returning a status-0
// receipt with the tx hash populated.
func signAndSend(t *testing.T, sim *simulated.Backend, key *ecdsa.PrivateKey, tx *types.Transaction) *types.Receipt {
	t.Helper()
	signer := types.LatestSignerForChainID(tx.ChainId())
	signed, err := types.SignTx(tx, signer, key)
	if err != nil {
		t.Fatalf("SignTx: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := sim.Client().SendTransaction(ctx, signed); err != nil {
		// Simulated backend synchronously surfaces reverts here for
		// setCoordinator-by-wrong-caller. Return a zero-status receipt so
		// assertions can distinguish reject from accept.
		return &types.Receipt{Status: 0, TxHash: signed.Hash()}
	}
	sim.Commit()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		r, err := sim.Client().TransactionReceipt(ctx, signed.Hash())
		if err == nil {
			return r
		}
		if !errors.Is(err, ethereum.NotFound) {
			t.Fatalf("TransactionReceipt: %v", err)
		}
		time.Sleep(30 * time.Millisecond)
	}
	t.Fatalf("receipt not mined")
	return nil
}

// buildDeployTx creates a contract-creation tx (To = nil) with the raw
// bytecode + encoded constructor args appended to Data.
func buildDeployTx(t *testing.T, sim *simulated.Backend, from common.Address, chainID *big.Int, bytecode []byte, ctorArgs []byte) *types.Transaction {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	client := sim.Client()
	nonce, _ := client.PendingNonceAt(ctx, from)
	header, _ := client.HeaderByNumber(ctx, nil)
	tip := big.NewInt(1_000_000_000)
	baseFee := header.BaseFee
	if baseFee == nil {
		baseFee = big.NewInt(1_000_000_000)
	}
	maxFee := new(big.Int).Mul(baseFee, big.NewInt(2))
	maxFee.Add(maxFee, tip)

	return types.NewTx(&types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     nonce,
		Gas:       3_000_000,
		GasTipCap: tip,
		GasFeeCap: maxFee,
		Value:     big.NewInt(0),
		Data:      append(append([]byte{}, bytecode...), ctorArgs...),
	})
}

func buildCallTx(t *testing.T, sim *simulated.Backend, from, to common.Address, chainID *big.Int, data []byte) *types.Transaction {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	client := sim.Client()
	nonce, _ := client.PendingNonceAt(ctx, from)
	header, _ := client.HeaderByNumber(ctx, nil)
	tip := big.NewInt(1_000_000_000)
	baseFee := header.BaseFee
	if baseFee == nil {
		baseFee = big.NewInt(1_000_000_000)
	}
	maxFee := new(big.Int).Mul(baseFee, big.NewInt(2))
	maxFee.Add(maxFee, tip)

	return types.NewTx(&types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     nonce,
		Gas:       150_000,
		GasTipCap: tip,
		GasFeeCap: maxFee,
		To:        &to,
		Value:     big.NewInt(0),
		Data:      data,
	})
}

// readCoordinator queries coordinator() via CallContract. Returns the
// 20-byte address the pool currently reports.
func readCoordinator(t *testing.T, sim *simulated.Backend, pool common.Address) common.Address {
	t.Helper()
	selector := crypto.Keccak256([]byte("coordinator()"))[:4]
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	out, err := sim.Client().CallContract(ctx, ethereum.CallMsg{To: &pool, Data: selector}, nil)
	if err != nil {
		t.Fatalf("CallContract coordinator(): %v", err)
	}
	if len(out) != 32 {
		t.Fatalf("coordinator() return len = %d, want 32", len(out))
	}
	var addr common.Address
	copy(addr[:], out[12:])
	return addr
}

type rotationHarness struct {
	sim          *simulated.Backend
	origKey      *ecdsa.PrivateKey
	origAddr     common.Address
	newKey       *ecdsa.PrivateKey
	newAddr      common.Address
	pool         common.Address
	chainID      *big.Int
}

func setupHarness(t *testing.T) *rotationHarness {
	t.Helper()

	origKey, _ := crypto.GenerateKey()
	newKey, _ := crypto.GenerateKey()
	origAddr := crypto.PubkeyToAddress(origKey.PublicKey)
	newAddr := crypto.PubkeyToAddress(newKey.PublicKey)

	alloc := types.GenesisAlloc{
		origAddr: {Balance: big.NewInt(1e18)},
		newAddr:  {Balance: big.NewInt(1e18)},
	}
	sim := simulated.NewBackend(alloc)
	t.Cleanup(func() { _ = sim.Close() })

	chainID, _ := sim.Client().ChainID(context.Background())

	// Deploy pool: rewardToken placeholder (not used by rotation),
	// coordinator = origAddr.
	bytecode := loadPersistencePoolBytecode(t)
	placeholderToken := common.HexToAddress("0x0000000000000000000000000000000000001234")
	ctorArgs := append(padAddrWord(placeholderToken), padAddrWord(origAddr)...)
	deployTx := buildDeployTx(t, sim, origAddr, chainID, bytecode, ctorArgs)
	receipt := signAndSend(t, sim, origKey, deployTx)
	if receipt.Status != 1 {
		t.Fatalf("pool deploy reverted (status %d)", receipt.Status)
	}
	if (receipt.ContractAddress == common.Address{}) {
		t.Fatal("deploy receipt missing contract address")
	}

	return &rotationHarness{
		sim:      sim,
		origKey:  origKey,
		origAddr: origAddr,
		newKey:   newKey,
		newAddr:  newAddr,
		pool:     receipt.ContractAddress,
		chainID:  chainID,
	}
}

func (h *rotationHarness) callSetCoordinator(t *testing.T, caller *ecdsa.PrivateKey, callerAddr common.Address, target [20]byte) *types.Receipt {
	t.Helper()
	data, err := rotate.EncodeSetCoordinator(target)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	tx := buildCallTx(t, h.sim, callerAddr, h.pool, h.chainID, data)
	return signAndSend(t, h.sim, caller, tx)
}

// TestRotateCoordinatorToNewEOA — current coordinator rotates authority
// to a new EOA. Event emits; on-chain coordinator() now equals newAddr.
func TestRotateCoordinatorToNewEOA(t *testing.T) {
	h := setupHarness(t)

	if got := readCoordinator(t, h.sim, h.pool); got != h.origAddr {
		t.Fatalf("pre-rotate coordinator = %s, want %s", got, h.origAddr)
	}

	var newCoord [20]byte
	copy(newCoord[:], h.newAddr.Bytes())
	r := h.callSetCoordinator(t, h.origKey, h.origAddr, newCoord)
	if r.Status != 1 {
		t.Fatalf("rotation tx status = %d, want 1", r.Status)
	}

	if got := readCoordinator(t, h.sim, h.pool); got != h.newAddr {
		t.Fatalf("post-rotate coordinator = %s, want %s", got, h.newAddr)
	}
}

// TestOldCoordinatorRejectedAfterRotation — after rotation, the old
// key can no longer call setCoordinator.
func TestOldCoordinatorRejectedAfterRotation(t *testing.T) {
	h := setupHarness(t)

	var newCoord [20]byte
	copy(newCoord[:], h.newAddr.Bytes())
	if r := h.callSetCoordinator(t, h.origKey, h.origAddr, newCoord); r.Status != 1 {
		t.Fatalf("initial rotation failed: status %d", r.Status)
	}

	// Old coord attempts another rotation — must revert.
	another := common.HexToAddress("0x000000000000000000000000000000000000DEAD")
	var anotherArr [20]byte
	copy(anotherArr[:], another.Bytes())
	r2 := h.callSetCoordinator(t, h.origKey, h.origAddr, anotherArr)
	if r2.Status != 0 {
		t.Fatalf("old-coord rotation status = %d, want 0 (revert)", r2.Status)
	}

	if got := readCoordinator(t, h.sim, h.pool); got != h.newAddr {
		t.Fatalf("after reject: coordinator = %s, want %s", got, h.newAddr)
	}
}

// TestRotationReversible — new coordinator can rotate back to original.
// Proves the escape hatch for a misconfigured multisig rotation.
func TestRotationReversible(t *testing.T) {
	h := setupHarness(t)

	var newCoord [20]byte
	copy(newCoord[:], h.newAddr.Bytes())
	if r := h.callSetCoordinator(t, h.origKey, h.origAddr, newCoord); r.Status != 1 {
		t.Fatalf("forward rotation status = %d", r.Status)
	}

	var origCoord [20]byte
	copy(origCoord[:], h.origAddr.Bytes())
	if r := h.callSetCoordinator(t, h.newKey, h.newAddr, origCoord); r.Status != 1 {
		t.Fatalf("reverse rotation status = %d", r.Status)
	}

	if got := readCoordinator(t, h.sim, h.pool); got != h.origAddr {
		t.Fatalf("after reverse: coordinator = %s, want %s", got, h.origAddr)
	}
}
