package whip

import (
	"crypto/ecdsa"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

// signEIP191 — test helper that signs a message the same way a Privy
// / MetaMask wallet would, producing a 65-byte r||s||v buffer with v
// in the {27,28} set.
func signEIP191(t *testing.T, key *ecdsa.PrivateKey, message []byte) []byte {
	t.Helper()
	prefixed := []byte(fmt.Sprintf("%s%d", eip191Prefix, len(message)))
	prefixed = append(prefixed, message...)
	hash := ethcrypto.Keccak256(prefixed)
	sig, err := ethcrypto.Sign(hash, key)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	// Ecrecover-compatible signatures from go-ethereum have v in {0,1};
	// EIP-191 wallets emit {27,28}. Normalise to wallet format so the
	// RecoverEIP191 helper's v-- branch is exercised.
	if sig[64] < 27 {
		sig[64] += 27
	}
	return sig
}

func ethAddress(t *testing.T, key *ecdsa.PrivateKey) string {
	t.Helper()
	pub := key.Public().(*ecdsa.PublicKey)
	addr := ethcrypto.PubkeyToAddress(*pub)
	return "0x" + hex.EncodeToString(addr.Bytes())
}

func didFromAddress(addr string) string {
	return "did:pkh:eip155:84532:" + addr
}

func TestRecoverEIP191RoundTrip(t *testing.T) {
	key, err := ethcrypto.GenerateKey()
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	msg := []byte("v=0\no=- 1 1 IN IP4 0.0.0.0\ns=-\n")
	sig := signEIP191(t, key, msg)

	got, err := RecoverEIP191(msg, sig)
	if err != nil {
		t.Fatalf("RecoverEIP191: %v", err)
	}
	want := ethAddress(t, key)
	if got != want {
		t.Fatalf("recovered=%s want=%s", got, want)
	}
}

func TestVerifySignatureForDIDValid(t *testing.T) {
	key, _ := ethcrypto.GenerateKey()
	msg := "hello aevia"
	sig := signEIP191(t, key, []byte(msg))
	did := didFromAddress(ethAddress(t, key))

	if err := VerifySignatureForDID(did, msg, sig); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestVerifySignatureForDIDMismatch(t *testing.T) {
	keyA, _ := ethcrypto.GenerateKey()
	keyB, _ := ethcrypto.GenerateKey()
	msg := "tampered"
	sig := signEIP191(t, keyA, []byte(msg))
	didB := didFromAddress(ethAddress(t, keyB)) // claim wrong signer

	err := VerifySignatureForDID(didB, msg, sig)
	if !errors.Is(err, ErrDIDMismatch) {
		t.Fatalf("expected ErrDIDMismatch, got %v", err)
	}
}

func TestVerifySignatureForDIDMalformedSig(t *testing.T) {
	key, _ := ethcrypto.GenerateKey()
	did := didFromAddress(ethAddress(t, key))

	err := VerifySignatureForDID(did, "msg", []byte{0x01, 0x02, 0x03})
	if !errors.Is(err, ErrBadSignature) {
		t.Fatalf("expected ErrBadSignature, got %v", err)
	}
}

func TestParseHexSignature(t *testing.T) {
	buf := make([]byte, 65)
	for i := range buf {
		buf[i] = byte(i)
	}
	h := "0x" + hex.EncodeToString(buf)
	got, err := ParseHexSignature(h)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(got) != 65 {
		t.Fatalf("len=%d want 65", len(got))
	}
	if _, err := ParseHexSignature("0xdeadbeef"); err == nil {
		t.Fatalf("expected error on short sig")
	}
}

func TestAddressFromDID(t *testing.T) {
	addr := "0x000000000000000000000000000000000000dEaD"
	got, err := addressFromDID("did:pkh:eip155:84532:" + addr)
	if err != nil {
		t.Fatalf("addressFromDID: %v", err)
	}
	if got != "0x000000000000000000000000000000000000dead" {
		t.Fatalf("expected lowercase address, got %s", got)
	}
}
