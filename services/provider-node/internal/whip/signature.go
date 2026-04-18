package whip

import (
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

// EIP-191 personal_sign message prefix. Every wallet (MetaMask, Privy,
// ledger, trezor) produces signatures over this prefix + len + message,
// so the recovered address matches what the wallet UI showed the user.
const eip191Prefix = "\x19Ethereum Signed Message:\n"

// ErrBadSignature is returned when the provided signature cannot be
// parsed into a 65-byte (r || s || v) buffer.
var ErrBadSignature = errors.New("whip: signature must be 65 bytes (r||s||v)")

// ErrDIDMismatch is returned when the address recovered from the
// signature doesn't match the address claimed by the X-Aevia-DID header.
var ErrDIDMismatch = errors.New("whip: recovered address does not match DID")

// RecoverEIP191 recovers the Ethereum address (20 bytes, lowercase hex
// with 0x prefix) that signed message under EIP-191 personal_sign. The
// signature is the 65-byte r || s || v buffer, v is 27 or 28 (adjusted
// to 0/1 internally before recovery).
//
// The input message must be the EXACT bytes the client signed — for
// Aevia WHIP, this is the raw UTF-8 SDP offer body.
func RecoverEIP191(message, signature []byte) (string, error) {
	if len(signature) != 65 {
		return "", ErrBadSignature
	}
	// EIP-191 prefix + length + message, then keccak256 it.
	prefixed := []byte(fmt.Sprintf("%s%d", eip191Prefix, len(message)))
	prefixed = append(prefixed, message...)
	hash := keccak256(prefixed)

	// Normalise v: libraries emit 27/28, secp256k1 recover wants 0/1.
	sig := make([]byte, 65)
	copy(sig, signature)
	if sig[64] >= 27 {
		sig[64] -= 27
	}

	pub, err := ethcrypto.Ecrecover(hash, sig)
	if err != nil {
		return "", fmt.Errorf("whip: recover pubkey: %w", err)
	}
	// Ethereum address = last 20 bytes of keccak256(pubkey[1:]). pubkey
	// is the uncompressed form (0x04 || X || Y); skip the leading byte.
	addrHash := keccak256(pub[1:])
	return "0x" + hex.EncodeToString(addrHash[12:]), nil
}

// VerifySignatureForDID recovers the signer from signature+message and
// verifies it matches the address encoded in the DID string. Returns
// nil when valid, ErrDIDMismatch when the address diverges.
//
// DID format: did:pkh:eip155:<chain>:<address>. Case-insensitive on
// the hex address (per EIP-55 checksum rules are advisory, not required
// for signature verification).
func VerifySignatureForDID(did, message string, signature []byte) error {
	recovered, err := RecoverEIP191([]byte(message), signature)
	if err != nil {
		return err
	}
	claimed, err := addressFromDID(did)
	if err != nil {
		return err
	}
	if !strings.EqualFold(recovered, claimed) {
		return fmt.Errorf("%w: recovered=%s claimed=%s", ErrDIDMismatch, recovered, claimed)
	}
	return nil
}

// addressFromDID extracts the final "0x..." segment from a PKH DID.
func addressFromDID(did string) (string, error) {
	parts := strings.Split(did, ":")
	if len(parts) < 2 {
		return "", fmt.Errorf("whip: malformed DID %q", did)
	}
	tail := parts[len(parts)-1]
	if !strings.HasPrefix(tail, "0x") || len(tail) != 42 {
		return "", fmt.Errorf("whip: DID tail is not a 20-byte address: %q", tail)
	}
	return strings.ToLower(tail), nil
}

// ParseHexSignature decodes a 0x-prefixed or bare hex string into a
// 65-byte signature buffer.
func ParseHexSignature(s string) ([]byte, error) {
	s = strings.TrimPrefix(strings.TrimSpace(s), "0x")
	if len(s) != 130 {
		return nil, fmt.Errorf("%w: got %d hex chars, want 130", ErrBadSignature, len(s))
	}
	return hex.DecodeString(s)
}

// keccak256 is a thin wrapper so tests and callers don't depend on
// the exact go-ethereum path we use internally.
func keccak256(data []byte) []byte {
	return ethcrypto.Keccak256(data)
}
