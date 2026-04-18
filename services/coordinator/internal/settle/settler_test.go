package settle_test

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	libp2pcrypto "github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"

	"github.com/Leeaandrob/aevia/services/coordinator/internal/chain"
	"github.com/Leeaandrob/aevia/services/coordinator/internal/receipts"
	"github.com/Leeaandrob/aevia/services/coordinator/internal/settle"
	"github.com/Leeaandrob/aevia/services/coordinator/internal/wallet"
	"github.com/Leeaandrob/aevia/services/provider-node/por"
)

// mockChain records every tx sent and returns canned values for all
// other queries. Enough surface to drive settle.Settler end-to-end.
type mockChain struct {
	chainID       *big.Int
	nonce         uint64
	tip           *big.Int
	baseFee       *big.Int
	sentTx        *types.Transaction
	receiptStatus uint64
	blockNumber   uint64
	gasUsed       uint64
	sendErr       error
}

func (m *mockChain) ChainID(ctx context.Context) (*big.Int, error) { return m.chainID, nil }
func (m *mockChain) NonceAt(ctx context.Context, _ common.Address) (uint64, error) {
	return m.nonce, nil
}
func (m *mockChain) BalanceAt(ctx context.Context, _ common.Address) (*big.Int, error) {
	return big.NewInt(1e18), nil
}
func (m *mockChain) SuggestGasTipCap(ctx context.Context) (*big.Int, error) { return m.tip, nil }
func (m *mockChain) BaseFee(ctx context.Context) (*big.Int, error)          { return m.baseFee, nil }

func (m *mockChain) SendTransaction(ctx context.Context, tx *types.Transaction) error {
	if m.sendErr != nil {
		return m.sendErr
	}
	m.sentTx = tx
	return nil
}

func (m *mockChain) WaitMined(ctx context.Context, hash common.Hash, _ time.Duration) (*types.Receipt, error) {
	if m.sentTx == nil {
		return nil, errors.New("mock: no tx sent")
	}
	if hash != m.sentTx.Hash() {
		return nil, errors.New("mock: hash mismatch")
	}
	return &types.Receipt{
		Status:      m.receiptStatus,
		BlockNumber: new(big.Int).SetUint64(m.blockNumber),
		GasUsed:     m.gasUsed,
		TxHash:      hash,
	}, nil
}
func (m *mockChain) CallContract(_ context.Context, _ ethereum.CallMsg) ([]byte, error) {
	return nil, nil
}
func (m *mockChain) Close() {}

// staticResolver maps PeerID string → EVM address for tests.
type staticResolver map[string]common.Address

func (s staticResolver) AddressForPeer(pid string) (common.Address, error) {
	addr, ok := s[pid]
	if !ok {
		return common.Address{}, fmt.Errorf("mock resolver: no mapping for %s", pid)
	}
	return addr, nil
}

// keypairAndPID returns a libp2p keypair + its PeerID string.
func keypairAndPID(t *testing.T) (libp2pcrypto.PrivKey, string) {
	t.Helper()
	priv, _, err := libp2pcrypto.GenerateEd25519Key(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateEd25519Key: %v", err)
	}
	pid, err := peer.IDFromPublicKey(priv.GetPublic())
	if err != nil {
		t.Fatalf("IDFromPublicKey: %v", err)
	}
	return priv, pid.String()
}

// makeReceipt builds a dual-signed por.Receipt ready for the aggregator.
func makeReceipt(t *testing.T, providerPriv libp2pcrypto.PrivKey, providerPID string,
	viewerPriv libp2pcrypto.PrivKey, viewerPID string, nonce uint64, size int) *por.Receipt {
	t.Helper()
	r := &por.Receipt{
		ProviderPeerID: providerPID,
		ViewerPeerID:   viewerPID,
		CID:            "bafkreitest",
		SegmentIndex:   int(nonce),
		SegmentSize:    size,
		TimestampUnix:  100,
		Nonce:          nonce,
	}
	if err := r.SignAsViewer(viewerPriv); err != nil {
		t.Fatalf("SignAsViewer: %v", err)
	}
	if err := r.SignAsProvider(providerPriv); err != nil {
		t.Fatalf("SignAsProvider: %v", err)
	}
	return r
}

const testHexKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

func TestSettleOnceHappyPath(t *testing.T) {
	reader, err := receipts.OpenInMemory()
	if err != nil {
		t.Fatalf("OpenInMemory: %v", err)
	}
	t.Cleanup(func() { _ = reader.Close() })

	providerPriv, providerPID := keypairAndPID(t)
	viewerPriv, viewerPID := keypairAndPID(t)
	rs := reader.UnderlyingReceiptStore()
	for i := 0; i < 3; i++ {
		_ = rs.Put(makeReceipt(t, providerPriv, providerPID, viewerPriv, viewerPID, uint64(i+1), 1000))
	}

	providerAddr := common.HexToAddress("0xABc0000000000000000000000000000000000001")

	mc := &mockChain{
		chainID:       big.NewInt(84532),
		nonce:         5,
		tip:           big.NewInt(100_000),
		baseFee:       big.NewInt(1_000_000),
		receiptStatus: 1,
		blockNumber:   40_000_000,
		gasUsed:       220_000,
	}
	w, err := wallet.LoadFromHex(testHexKey, big.NewInt(84532))
	if err != nil {
		t.Fatalf("wallet: %v", err)
	}
	resolver := staticResolver{providerPID: providerAddr}

	settler, err := settle.New(mc, w, reader, resolver, settle.Config{
		PoolAddress:  common.HexToAddress("0x735C363a6df4651ABD8b1081F0b73fdAd98a4a93"),
		GasLimit:     300_000,
		Timeout:      5 * time.Second,
		TotalRewards: big.NewInt(3_000_000),
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	res, err := settler.SettleOnce(context.Background(), 0, 0)
	if err != nil {
		t.Fatalf("SettleOnce: %v", err)
	}
	if res.ReceiptCount != 3 {
		t.Errorf("ReceiptCount = %d, want 3", res.ReceiptCount)
	}
	if res.TotalBytes != 3000 {
		t.Errorf("TotalBytes = %d, want 3000", res.TotalBytes)
	}
	if got := res.Providers[providerAddr]; got != 3000 {
		t.Errorf("Providers[addr] = %d, want 3000", got)
	}
	if mc.sentTx == nil {
		t.Fatal("no tx sent")
	}
	if *mc.sentTx.To() != common.HexToAddress("0x735C363a6df4651ABD8b1081F0b73fdAd98a4a93") {
		t.Fatalf("tx.To = %s", mc.sentTx.To())
	}
	// Calldata must start with the submitSettlement selector 0x48db471d.
	if len(res.Calldata) < 4 || res.Calldata[0] != 0x48 || res.Calldata[1] != 0xdb || res.Calldata[2] != 0x47 || res.Calldata[3] != 0x1d {
		t.Fatalf("calldata selector mismatch: %x", res.Calldata[:4])
	}
	if res.BlockNumber != 40_000_000 {
		t.Errorf("BlockNumber = %d", res.BlockNumber)
	}
	if res.GasUsed != 220_000 {
		t.Errorf("GasUsed = %d", res.GasUsed)
	}
}

func TestSettleOnceReturnsErrNoReceiptsOnEmptyWindow(t *testing.T) {
	reader, err := receipts.OpenInMemory()
	if err != nil {
		t.Fatalf("OpenInMemory: %v", err)
	}
	t.Cleanup(func() { _ = reader.Close() })

	mc := &mockChain{chainID: big.NewInt(1), tip: big.NewInt(1), baseFee: big.NewInt(1)}
	w, _ := wallet.LoadFromHex(testHexKey, big.NewInt(1))
	resolver := staticResolver{}

	settler, err := settle.New(mc, w, reader, resolver, settle.Config{
		PoolAddress:  common.HexToAddress("0x1"),
		TotalRewards: big.NewInt(1),
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	_, err = settler.SettleOnce(context.Background(), 0, 0)
	if !errors.Is(err, settle.ErrNoReceipts) {
		t.Fatalf("err = %v, want ErrNoReceipts", err)
	}
}

func TestSettleOnceFailsWhenResolverHasNoMapping(t *testing.T) {
	reader, _ := receipts.OpenInMemory()
	t.Cleanup(func() { _ = reader.Close() })

	providerPriv, providerPID := keypairAndPID(t)
	viewerPriv, viewerPID := keypairAndPID(t)
	_ = reader.UnderlyingReceiptStore().Put(makeReceipt(t, providerPriv, providerPID, viewerPriv, viewerPID, 1, 1000))

	mc := &mockChain{chainID: big.NewInt(1), tip: big.NewInt(1), baseFee: big.NewInt(1), receiptStatus: 1}
	w, _ := wallet.LoadFromHex(testHexKey, big.NewInt(1))
	resolver := staticResolver{} // empty — provider not mapped

	settler, _ := settle.New(mc, w, reader, resolver, settle.Config{
		PoolAddress:  common.HexToAddress("0x1"),
		TotalRewards: big.NewInt(1),
	})
	_, err := settler.SettleOnce(context.Background(), 0, 0)
	if err == nil {
		t.Fatal("SettleOnce accepted unresolved peer")
	}
}

func TestNewRejectsMissingDeps(t *testing.T) {
	w, _ := wallet.LoadFromHex(testHexKey, big.NewInt(1))
	reader, _ := receipts.OpenInMemory()
	t.Cleanup(func() { _ = reader.Close() })

	cfg := settle.Config{PoolAddress: common.HexToAddress("0x1"), TotalRewards: big.NewInt(1)}

	mc := &mockChain{chainID: big.NewInt(1)}
	resolver := staticResolver{}

	cases := []struct {
		name     string
		chain    chain.Client
		wallet   *wallet.Wallet
		reader   receipts.WindowReader
		resolver settle.AddressResolver
		cfg      settle.Config
	}{
		{"nil chain", nil, w, reader, resolver, cfg},
		{"nil wallet", mc, nil, reader, resolver, cfg},
		{"nil reader", mc, w, nil, resolver, cfg},
		{"nil resolver", mc, w, reader, nil, cfg},
		{"zero pool", mc, w, reader, resolver, settle.Config{TotalRewards: big.NewInt(1)}},
		{"nil rewards", mc, w, reader, resolver, settle.Config{PoolAddress: common.HexToAddress("0x1")}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := settle.New(tc.chain, tc.wallet, tc.reader, tc.resolver, tc.cfg); err == nil {
				t.Fatal("accepted bad input")
			}
		})
	}
}
