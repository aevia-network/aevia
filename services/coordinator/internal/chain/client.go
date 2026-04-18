// Package chain wraps go-ethereum's ethclient with the narrow surface the
// coordinator actually needs:
//   - chain ID discovery (for EIP-155 signing)
//   - raw transaction broadcast
//   - transaction receipt polling with timeout
//   - suggested gas/fee hints for EIP-1559
//   - address-level view queries (nonce, balance)
//
// Everything else from ethclient stays one Underlying() call away for
// callers that need it, but the narrow public surface makes the package
// easy to mock in tests (see MockClient in chain_test.go).
package chain

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Client is the interface the coordinator depends on. Any implementation
// that satisfies it can drive settlements — real ethclient in production,
// simulated.Backend.Client() in integration tests, or a hand-written mock
// in unit tests.
type Client interface {
	ChainID(ctx context.Context) (*big.Int, error)
	NonceAt(ctx context.Context, addr common.Address) (uint64, error)
	BalanceAt(ctx context.Context, addr common.Address) (*big.Int, error)
	SuggestGasTipCap(ctx context.Context) (*big.Int, error)
	BaseFee(ctx context.Context) (*big.Int, error)
	SendTransaction(ctx context.Context, tx *types.Transaction) error
	WaitMined(ctx context.Context, txHash common.Hash, timeout time.Duration) (*types.Receipt, error)
	CallContract(ctx context.Context, msg ethereum.CallMsg) ([]byte, error)
	Close()
}

// Dial opens an ethclient connection to rpcURL and wraps it in our Client
// interface. Caller must Close() when done.
func Dial(ctx context.Context, rpcURL string) (Client, error) {
	if rpcURL == "" {
		return nil, errors.New("chain: rpc URL is empty")
	}
	ec, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return nil, fmt.Errorf("chain: dial %s: %w", rpcURL, err)
	}
	return Wrap(ec), nil
}

// Wrap lets callers (typically tests using simulated.Backend) plug a
// pre-constructed *ethclient.Client into our surface.
func Wrap(ec *ethclient.Client) Client {
	return &ethclientWrapper{ec: ec}
}

type ethclientWrapper struct {
	ec *ethclient.Client
}

func (w *ethclientWrapper) ChainID(ctx context.Context) (*big.Int, error) {
	return w.ec.ChainID(ctx)
}

func (w *ethclientWrapper) NonceAt(ctx context.Context, addr common.Address) (uint64, error) {
	return w.ec.PendingNonceAt(ctx, addr)
}

func (w *ethclientWrapper) BalanceAt(ctx context.Context, addr common.Address) (*big.Int, error) {
	return w.ec.BalanceAt(ctx, addr, nil)
}

func (w *ethclientWrapper) SuggestGasTipCap(ctx context.Context) (*big.Int, error) {
	return w.ec.SuggestGasTipCap(ctx)
}

func (w *ethclientWrapper) BaseFee(ctx context.Context) (*big.Int, error) {
	h, err := w.ec.HeaderByNumber(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("chain: header for base fee: %w", err)
	}
	if h.BaseFee == nil {
		return big.NewInt(0), nil
	}
	return new(big.Int).Set(h.BaseFee), nil
}

func (w *ethclientWrapper) SendTransaction(ctx context.Context, tx *types.Transaction) error {
	return w.ec.SendTransaction(ctx, tx)
}

// WaitMined polls for the receipt until it appears or ctx expires /
// timeout elapses. Typical chain interval on Base is 2 s; callers
// targeting ~3 confirmations should pass timeout in the 15-30 s range.
func (w *ethclientWrapper) WaitMined(ctx context.Context, txHash common.Hash, timeout time.Duration) (*types.Receipt, error) {
	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		receipt, err := w.ec.TransactionReceipt(ctx, txHash)
		if err == nil {
			return receipt, nil
		}
		if !errors.Is(err, ethereum.NotFound) {
			return nil, fmt.Errorf("chain: TransactionReceipt: %w", err)
		}
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("chain: receipt %s not mined within %s", txHash.Hex(), timeout)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
		}
	}
}

func (w *ethclientWrapper) CallContract(ctx context.Context, msg ethereum.CallMsg) ([]byte, error) {
	return w.ec.CallContract(ctx, msg, nil)
}

func (w *ethclientWrapper) Close() { w.ec.Close() }

// EffectiveFees computes the gas cap (maxFeePerGas) and priority tip for a
// pending EIP-1559 tx given a fresh baseFee. Cap = 2 * baseFee + tip is
// the standard advice (gives ~6 blocks of headroom on Base).
func EffectiveFees(baseFee, tip *big.Int) (maxFee *big.Int, priority *big.Int) {
	if baseFee == nil {
		baseFee = big.NewInt(0)
	}
	if tip == nil {
		tip = big.NewInt(0)
	}
	maxFee = new(big.Int).Mul(baseFee, big.NewInt(2))
	maxFee.Add(maxFee, tip)
	return maxFee, new(big.Int).Set(tip)
}
