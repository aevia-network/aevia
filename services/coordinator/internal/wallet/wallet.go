// Package wallet holds the coordinator's signing key and produces signed
// EIP-1559 transactions ready for RPC broadcast.
//
// For M7 the coordinator runs with a hot EOA key loaded from env
// (DEPLOYER_PRIVATE_KEY in the deployer-is-coordinator Sepolia MVP).
// Production rotates the coordinator to a Safe multisig; the rotation
// itself is a single setCoordinator(newAddr) tx from this wallet.
package wallet

import (
	"crypto/ecdsa"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// Wallet is a minimal hot wallet: one key, one address, one Sign method.
type Wallet struct {
	priv    *ecdsa.PrivateKey
	addr    common.Address
	chainID *big.Int
}

// LoadFromHex parses a 0x-prefixed or bare hex private key, binds it to
// chainID, and returns a ready-to-sign Wallet.
func LoadFromHex(hexKey string, chainID *big.Int) (*Wallet, error) {
	if hexKey == "" {
		return nil, errors.New("wallet: hex key is empty")
	}
	if chainID == nil || chainID.Sign() <= 0 {
		return nil, errors.New("wallet: chainID must be positive")
	}
	cleaned := strings.TrimPrefix(strings.TrimSpace(hexKey), "0x")
	if _, err := hex.DecodeString(cleaned); err != nil {
		return nil, fmt.Errorf("wallet: parse hex key: %w", err)
	}
	priv, err := crypto.HexToECDSA(cleaned)
	if err != nil {
		return nil, fmt.Errorf("wallet: HexToECDSA: %w", err)
	}
	addr := crypto.PubkeyToAddress(priv.PublicKey)
	return &Wallet{priv: priv, addr: addr, chainID: new(big.Int).Set(chainID)}, nil
}

// Address returns the wallet's Ethereum address.
func (w *Wallet) Address() common.Address { return w.addr }

// ChainID returns the chainID this wallet will sign for.
func (w *Wallet) ChainID() *big.Int { return new(big.Int).Set(w.chainID) }

// TxParams is the narrow input to SignTx — callers fill in what they know
// (nonce, recipient, calldata, gas cap, tip, gas limit) and SignTx
// produces an EIP-1559 DynamicFeeTx bound to this wallet's chain.
type TxParams struct {
	Nonce    uint64
	To       common.Address
	Value    *big.Int
	Data     []byte
	GasLimit uint64
	MaxFee   *big.Int
	Priority *big.Int
}

// SignTx assembles an EIP-1559 dynamic fee tx from p and signs it with
// this wallet's key. Returns a tx ready for chain.SendTransaction.
func (w *Wallet) SignTx(p TxParams) (*types.Transaction, error) {
	if p.GasLimit == 0 {
		return nil, errors.New("wallet: GasLimit is zero")
	}
	if p.MaxFee == nil || p.MaxFee.Sign() <= 0 {
		return nil, errors.New("wallet: MaxFee must be positive")
	}
	if p.Priority == nil || p.Priority.Sign() < 0 {
		return nil, errors.New("wallet: Priority must be non-negative")
	}
	if p.Value == nil {
		p.Value = big.NewInt(0)
	}

	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   new(big.Int).Set(w.chainID),
		Nonce:     p.Nonce,
		GasTipCap: new(big.Int).Set(p.Priority),
		GasFeeCap: new(big.Int).Set(p.MaxFee),
		Gas:       p.GasLimit,
		To:        &p.To,
		Value:     new(big.Int).Set(p.Value),
		Data:      append([]byte(nil), p.Data...),
	})

	signer := types.LatestSignerForChainID(w.chainID)
	signed, err := types.SignTx(tx, signer, w.priv)
	if err != nil {
		return nil, fmt.Errorf("wallet: SignTx: %w", err)
	}
	return signed, nil
}
