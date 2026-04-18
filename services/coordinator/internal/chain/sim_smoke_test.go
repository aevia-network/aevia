package chain_test

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient/simulated"

	"github.com/Leeaandrob/aevia/services/coordinator/internal/chain"
	"github.com/Leeaandrob/aevia/services/coordinator/internal/wallet"
)

// TestChainClientAgainstSimulatedBackend proves our wallet-signed EIP-1559
// tx is accepted by a real in-process EVM. Closes the gap between the
// unit-level SignTx test (signature-only) and a live chain driving a
// full tx lifecycle: fetch nonce + base fee, sign, broadcast, mine,
// fetch receipt, assert status 1.
//
// simulated.Backend.Client() is an interface distinct from *ethclient.Client,
// so the test uses it directly rather than through chain.Wrap. The
// production wrapper is exercised against real RPC in M7 ops #1 + #2.
func TestChainClientAgainstSimulatedBackend(t *testing.T) {
	priv, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	from := crypto.PubkeyToAddress(priv.PublicKey)

	alloc := types.GenesisAlloc{
		from: {Balance: big.NewInt(1e18)},
	}
	sim := simulated.NewBackend(alloc)
	t.Cleanup(func() { _ = sim.Close() })

	simClient := sim.Client()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	chainID, err := simClient.ChainID(ctx)
	if err != nil {
		t.Fatalf("ChainID: %v", err)
	}

	w, err := wallet.LoadFromHex(common.Bytes2Hex(crypto.FromECDSA(priv)), chainID)
	if err != nil {
		t.Fatalf("wallet: %v", err)
	}
	if w.Address() != from {
		t.Fatalf("wallet addr %s != sim from %s", w.Address(), from)
	}

	nonce, err := simClient.PendingNonceAt(ctx, from)
	if err != nil {
		t.Fatalf("nonce: %v", err)
	}
	tip, err := simClient.SuggestGasTipCap(ctx)
	if err != nil {
		t.Fatalf("tip: %v", err)
	}
	header, err := simClient.HeaderByNumber(ctx, nil)
	if err != nil {
		t.Fatalf("header: %v", err)
	}
	base := header.BaseFee
	if base == nil {
		base = big.NewInt(1_000_000_000)
	}
	maxFee, prio := chain.EffectiveFees(base, tip)

	tx, err := w.SignTx(wallet.TxParams{
		Nonce:    nonce,
		To:       from,
		Value:    big.NewInt(1),
		Data:     nil,
		GasLimit: 30_000,
		MaxFee:   maxFee,
		Priority: prio,
	})
	if err != nil {
		t.Fatalf("SignTx: %v", err)
	}
	if err := simClient.SendTransaction(ctx, tx); err != nil {
		t.Fatalf("SendTransaction: %v", err)
	}

	// Simulated backend does not auto-mine — force one block.
	sim.Commit()

	// Poll for the receipt.
	deadline := time.Now().Add(3 * time.Second)
	var receipt *types.Receipt
	for time.Now().Before(deadline) {
		r, err := simClient.TransactionReceipt(ctx, tx.Hash())
		if err == nil {
			receipt = r
			break
		}
		if err != ethereum.NotFound {
			t.Fatalf("TransactionReceipt: %v", err)
		}
		time.Sleep(50 * time.Millisecond)
	}
	if receipt == nil {
		t.Fatalf("receipt %s not mined", tx.Hash().Hex())
	}
	if receipt.Status != 1 {
		t.Fatalf("status = %d, want 1", receipt.Status)
	}
}
