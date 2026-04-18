package por

import (
	"encoding/binary"
	"fmt"
	"math/big"

	"golang.org/x/crypto/sha3"
)

// submitSettlementSelector is the first 4 bytes of keccak256 over the
// canonical Solidity signature. Precomputed and cached at init; a runtime
// mismatch means the contract ABI drifted and we must fix either side.
var submitSettlementSelector = keccak256([]byte(
	"submitSettlement(bytes32,address[],uint256[],uint256)",
))[:4]

// EncodeSubmitSettlement produces ABI-encoded calldata for
// PersistencePool.submitSettlement(bytes32, address[], uint256[], uint256).
// Parallel arrays are emitted in the order given — caller is responsible
// for the sort-by-address convention the contract expects.
//
// Validated against a forge snapshot in TestEncodeSubmitSettlementMatchesForgeVector.
func EncodeSubmitSettlement(
	merkleRoot [32]byte,
	providers [][20]byte,
	bytesServed []uint64,
	totalRewards *big.Int,
) ([]byte, error) {
	if len(providers) != len(bytesServed) {
		return nil, fmt.Errorf("por: providers/bytesServed length mismatch: %d vs %d", len(providers), len(bytesServed))
	}
	if totalRewards == nil {
		return nil, fmt.Errorf("por: totalRewards is nil")
	}
	if totalRewards.Sign() < 0 {
		return nil, fmt.Errorf("por: totalRewards cannot be negative")
	}

	// Head layout (4 static words after selector):
	//   [0] merkleRoot       (bytes32)
	//   [1] offset providers (uint256 — offset in bytes from start of args)
	//   [2] offset bytes     (uint256)
	//   [3] totalRewards     (uint256)
	// Tails:
	//   at offset[1]: providers.length (uint256), then 32-byte left-padded addrs.
	//   at offset[2]: bytesServed.length, then 32-byte uint256s.
	const wordSize = 32
	const headerWords = 4

	providersTailSize := wordSize + wordSize*len(providers)
	bytesTailSize := wordSize + wordSize*len(bytesServed)

	offsetProviders := uint64(headerWords * wordSize)
	offsetBytes := offsetProviders + uint64(providersTailSize)

	buf := make([]byte, 0, 4+headerWords*wordSize+providersTailSize+bytesTailSize)
	buf = append(buf, submitSettlementSelector...)
	buf = append(buf, merkleRoot[:]...)
	buf = append(buf, uint256Word(new(big.Int).SetUint64(offsetProviders))...)
	buf = append(buf, uint256Word(new(big.Int).SetUint64(offsetBytes))...)
	buf = append(buf, uint256Word(totalRewards)...)

	// providers tail: length + each address left-padded to 32 bytes.
	buf = append(buf, uint256Word(new(big.Int).SetUint64(uint64(len(providers))))...)
	for _, addr := range providers {
		padded := make([]byte, 32)
		copy(padded[12:], addr[:])
		buf = append(buf, padded...)
	}

	// bytesServed tail.
	buf = append(buf, uint256Word(new(big.Int).SetUint64(uint64(len(bytesServed))))...)
	for _, b := range bytesServed {
		buf = append(buf, uint256Word(new(big.Int).SetUint64(b))...)
	}

	return buf, nil
}

// uint256Word encodes a non-negative big.Int to 32 big-endian bytes.
// Values larger than 256 bits are rejected upstream by the ABI spec;
// we don't bother bounds-checking here beyond the sign.
func uint256Word(v *big.Int) []byte {
	word := make([]byte, 32)
	if v == nil || v.Sign() == 0 {
		return word
	}
	b := v.Bytes()
	copy(word[32-len(b):], b)
	return word
}

// keccak256 is the Ethereum variant (SHA3-Keccak, not NIST FIPS 202).
func keccak256(data []byte) []byte {
	h := sha3.NewLegacyKeccak256()
	h.Write(data)
	return h.Sum(nil)
}

// Uint64LE is an exported helper occasionally useful for operators
// debugging calldata in shell scripts.
func Uint64LE(v uint64) []byte {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, v)
	return b
}

// SubmitSettlementSelector returns a copy of the 4-byte function selector
// so callers can inspect/compare without importing sha3.
func SubmitSettlementSelector() [4]byte {
	var out [4]byte
	copy(out[:], submitSettlementSelector)
	return out
}
