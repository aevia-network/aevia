// Package settle wires the coordinator's upstream reader, receipt
// aggregator, Go ABI encoder, wallet signer, and chain client into a
// single SettleOnce(ctx) call.
//
// A Settler is intentionally stateless between calls — each SettleOnce
// re-reads the receipt window, rebuilds the Merkle commitment, and
// broadcasts a fresh tx. Nonce is fetched from the chain (not tracked
// locally) so coordinator restarts never produce a stale-nonce tx.
package settle

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Leeaandrob/aevia/services/coordinator/internal/chain"
	"github.com/Leeaandrob/aevia/services/coordinator/internal/receipts"
	"github.com/Leeaandrob/aevia/services/coordinator/internal/wallet"
	"github.com/Leeaandrob/aevia/services/provider-node/por"
)

// AddressResolver maps a libp2p PeerID to the Ethereum address that
// should receive the provider's cUSDC allocation. Production pulls
// this from an operator registration contract or off-chain DB; tests
// plug a static map.
type AddressResolver interface {
	AddressForPeer(peerID string) (common.Address, error)
}

// Config controls one settlement attempt.
type Config struct {
	PoolAddress common.Address
	// GasLimit is the gas cap passed to the signed tx. 500k is comfortable
	// for single-provider calls; large settlements benchmark ~1.2M.
	GasLimit uint64
	// Timeout is how long SettleOnce waits for the tx receipt before
	// giving up. 30s fits Base's 2s block time with slack.
	Timeout time.Duration
	// TotalRewards is the cUSDC-wei amount to distribute among providers
	// proportional to bytes served.
	TotalRewards *big.Int
}

// Settler assembles settlement transactions end-to-end.
type Settler struct {
	chain     chain.Client
	wallet    *wallet.Wallet
	reader    receipts.WindowReader
	resolver  AddressResolver
	cfg       Config
}

// New constructs a Settler. All four dependencies are required.
func New(ch chain.Client, w *wallet.Wallet, r receipts.WindowReader, resolver AddressResolver, cfg Config) (*Settler, error) {
	if ch == nil {
		return nil, errors.New("settle: chain client is nil")
	}
	if w == nil {
		return nil, errors.New("settle: wallet is nil")
	}
	if r == nil {
		return nil, errors.New("settle: receipts reader is nil")
	}
	if resolver == nil {
		return nil, errors.New("settle: address resolver is nil")
	}
	if cfg.PoolAddress == (common.Address{}) {
		return nil, errors.New("settle: pool address is zero")
	}
	if cfg.GasLimit == 0 {
		cfg.GasLimit = 500_000
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.TotalRewards == nil || cfg.TotalRewards.Sign() <= 0 {
		return nil, errors.New("settle: TotalRewards must be positive")
	}
	return &Settler{chain: ch, wallet: w, reader: r, resolver: resolver, cfg: cfg}, nil
}

// Result is what SettleOnce returns to the caller.
type Result struct {
	// ReceiptCount is how many por receipts went into this settlement.
	ReceiptCount int
	// Providers maps EVM address to bytes served (post-resolver).
	Providers map[common.Address]uint64
	// TotalBytes aggregated.
	TotalBytes uint64
	// MerkleRoot committed on-chain.
	MerkleRoot [32]byte
	// TxHash of the submitSettlement tx.
	TxHash common.Hash
	// BlockNumber at which the tx mined.
	BlockNumber uint64
	// GasUsed by the tx.
	GasUsed uint64
	// Calldata — the ABI payload por.EncodeSubmitSettlement produced.
	// Retained so the caller can log, debug, or diff against cast's
	// own encoder without another import.
	Calldata []byte
}

// ErrNoReceipts is returned when the receipt window is empty. Callers
// should treat it as a non-fatal no-op (the daemon just waits for the
// next tick).
var ErrNoReceipts = errors.New("settle: no receipts in window")

// SettleOnce runs one full settlement cycle over [since, until):
//  1. Reads receipts via WindowReader.
//  2. Calls por.BuildSettlement — validates every signature, builds the
//     sort-stable Merkle root, computes per-provider totals.
//  3. Resolves PeerID -> EVM address via the AddressResolver.
//  4. Encodes calldata via por.EncodeSubmitSettlement (the same
//     hand-rolled ABI path proven against real bytecode on Sepolia).
//  5. Fetches nonce + gas suggestions, signs with the wallet, broadcasts.
//  6. Polls for the receipt within cfg.Timeout.
//  7. Returns a Result or an error; never returns partial state.
func (s *Settler) SettleOnce(ctx context.Context, since, until int64) (*Result, error) {
	recs, err := s.reader.WindowForAllProviders(since, until)
	if err != nil {
		return nil, fmt.Errorf("settle: read window: %w", err)
	}
	if len(recs) == 0 {
		return nil, ErrNoReceipts
	}

	settlement, err := por.BuildSettlement(recs)
	if err != nil {
		return nil, fmt.Errorf("settle: build settlement: %w", err)
	}

	// Resolve PeerIDs to EVM addresses, preserving por's sorted order.
	addrs := make([][20]byte, len(settlement.Providers))
	for i, pid := range settlement.Providers {
		addr, err := s.resolver.AddressForPeer(pid)
		if err != nil {
			return nil, fmt.Errorf("settle: resolve peer %s: %w", pid, err)
		}
		if addr == (common.Address{}) {
			return nil, fmt.Errorf("settle: resolver returned zero address for peer %s", pid)
		}
		addrs[i] = addr
	}

	var root [32]byte
	copy(root[:], settlement.MerkleRoot)
	calldata, err := por.EncodeSubmitSettlement(root, addrs, settlement.PerProviderBytes, s.cfg.TotalRewards)
	if err != nil {
		return nil, fmt.Errorf("settle: encode calldata: %w", err)
	}

	nonce, err := s.chain.NonceAt(ctx, s.wallet.Address())
	if err != nil {
		return nil, fmt.Errorf("settle: nonce: %w", err)
	}
	tip, err := s.chain.SuggestGasTipCap(ctx)
	if err != nil {
		return nil, fmt.Errorf("settle: suggest tip: %w", err)
	}
	baseFee, err := s.chain.BaseFee(ctx)
	if err != nil {
		return nil, fmt.Errorf("settle: base fee: %w", err)
	}
	maxFee, priority := chain.EffectiveFees(baseFee, tip)

	tx, err := s.wallet.SignTx(wallet.TxParams{
		Nonce:    nonce,
		To:       s.cfg.PoolAddress,
		Data:     calldata,
		GasLimit: s.cfg.GasLimit,
		MaxFee:   maxFee,
		Priority: priority,
	})
	if err != nil {
		return nil, fmt.Errorf("settle: sign tx: %w", err)
	}
	if err := s.chain.SendTransaction(ctx, tx); err != nil {
		return nil, fmt.Errorf("settle: send tx: %w", err)
	}

	receipt, err := s.chain.WaitMined(ctx, tx.Hash(), s.cfg.Timeout)
	if err != nil {
		return nil, fmt.Errorf("settle: wait mined: %w", err)
	}
	if receipt.Status != 1 {
		return nil, fmt.Errorf("settle: tx %s reverted", tx.Hash().Hex())
	}

	providers := make(map[common.Address]uint64, len(addrs))
	for i, a := range addrs {
		providers[a] = settlement.PerProviderBytes[i]
	}

	return &Result{
		ReceiptCount: settlement.ReceiptCount,
		Providers:    providers,
		TotalBytes:   settlement.TotalBytes,
		MerkleRoot:   root,
		TxHash:       tx.Hash(),
		BlockNumber:  receipt.BlockNumber.Uint64(),
		GasUsed:      receipt.GasUsed,
		Calldata:     calldata,
	}, nil
}
