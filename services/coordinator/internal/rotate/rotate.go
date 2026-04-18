// Package rotate encapsulates coordinator rotation — the
// setCoordinator(address) on-chain call that transfers authority from
// one address to another.
//
// Rotation is the single operation that guards the pre-mainnet plan:
// before any mainnet deploy, the current hot EOA coordinator MUST
// transfer authority to a Safe multisig. This package provides the
// Go-side primitive; calling it against Base Sepolia or mainnet is an
// ops action triggered via `aevia-coordinator rotate-coordinator`.
package rotate

import (
	"encoding/hex"
	"errors"
	"fmt"

	"golang.org/x/crypto/sha3"
)

// setCoordinatorSelector is the first 4 bytes of keccak256 over the
// canonical Solidity signature. Pinned so a contract signature drift
// fails loudly.
var setCoordinatorSelector = keccak256([]byte("setCoordinator(address)"))[:4]

// EncodeSetCoordinator returns ABI-encoded calldata for
// PersistencePool.setCoordinator(address). The address is left-padded
// into a 32-byte word per ABI spec.
func EncodeSetCoordinator(newCoordinator [20]byte) ([]byte, error) {
	out := make([]byte, 0, 4+32)
	out = append(out, setCoordinatorSelector...)
	padded := make([]byte, 32)
	copy(padded[12:], newCoordinator[:])
	out = append(out, padded...)
	return out, nil
}

// DecodeSetCoordinator parses calldata produced by EncodeSetCoordinator
// and returns the embedded 20-byte address. Used by tests to round-trip
// and by operator tooling that wants to inspect pending txs.
func DecodeSetCoordinator(data []byte) ([20]byte, error) {
	if len(data) != 4+32 {
		return [20]byte{}, fmt.Errorf("rotate: expected 36 bytes, got %d", len(data))
	}
	if data[0] != setCoordinatorSelector[0] ||
		data[1] != setCoordinatorSelector[1] ||
		data[2] != setCoordinatorSelector[2] ||
		data[3] != setCoordinatorSelector[3] {
		return [20]byte{}, errors.New("rotate: selector mismatch (not a setCoordinator call)")
	}
	var addr [20]byte
	copy(addr[:], data[4+12:4+32])
	return addr, nil
}

// SelectorHex returns the 4-byte function selector as a lowercase hex
// string, useful for logging and comparison against Foundry output.
func SelectorHex() string { return hex.EncodeToString(setCoordinatorSelector) }

func keccak256(data []byte) []byte {
	h := sha3.NewLegacyKeccak256()
	h.Write(data)
	return h.Sum(nil)
}
