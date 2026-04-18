package por_test

import (
	"bytes"
	"crypto/rand"
	"testing"
	"time"

	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"

	"github.com/Leeaandrob/aevia/services/provider-node/por"
)

// keyPair generates an Ed25519 libp2p key and returns the keypair plus its
// derived PeerID string.
func keyPair(t *testing.T) (crypto.PrivKey, crypto.PubKey, string) {
	t.Helper()
	priv, pub, err := crypto.GenerateEd25519Key(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateEd25519Key: %v", err)
	}
	pid, err := peer.IDFromPublicKey(pub)
	if err != nil {
		t.Fatalf("IDFromPublicKey: %v", err)
	}
	return priv, pub, pid.String()
}

func freshReceipt(providerPID, viewerPID string) *por.Receipt {
	return &por.Receipt{
		ProviderPeerID: providerPID,
		ViewerPeerID:   viewerPID,
		CID:            "bafkreitestcid",
		SegmentIndex:   3,
		SegmentSize:    4096,
		TimestampUnix:  time.Now().Unix(),
		Nonce:          42,
	}
}

func TestCanonicalBytesIsDeterministic(t *testing.T) {
	_, _, providerPID := keyPair(t)
	_, _, viewerPID := keyPair(t)

	a := freshReceipt(providerPID, viewerPID)
	b := freshReceipt(providerPID, viewerPID)
	b.TimestampUnix = a.TimestampUnix

	if !bytes.Equal(a.CanonicalBytes(), b.CanonicalBytes()) {
		t.Fatal("CanonicalBytes differ for identical receipts")
	}
}

func TestCanonicalBytesChangesWithEveryField(t *testing.T) {
	_, _, providerPID := keyPair(t)
	_, _, viewerPID := keyPair(t)

	base := freshReceipt(providerPID, viewerPID)
	ref := base.CanonicalBytes()

	// Mutate each field and confirm the canonical output diverges.
	cases := []func(*por.Receipt){
		func(r *por.Receipt) { r.CID += "x" },
		func(r *por.Receipt) { r.SegmentIndex++ },
		func(r *por.Receipt) { r.SegmentSize++ },
		func(r *por.Receipt) { r.TimestampUnix++ },
		func(r *por.Receipt) { r.Nonce++ },
	}
	for i, mutate := range cases {
		cp := *base
		mutate(&cp)
		if bytes.Equal(cp.CanonicalBytes(), ref) {
			t.Errorf("case %d: mutation did not change canonical bytes", i)
		}
	}
}

func TestSignAndVerifyViewerRoundTrip(t *testing.T) {
	viewerPriv, _, viewerPID := keyPair(t)
	_, _, providerPID := keyPair(t)

	r := freshReceipt(providerPID, viewerPID)
	if err := r.SignAsViewer(viewerPriv); err != nil {
		t.Fatalf("SignAsViewer: %v", err)
	}
	if err := r.VerifyViewerSig(); err != nil {
		t.Fatalf("VerifyViewerSig: %v", err)
	}
}

func TestSignAndVerifyProviderRoundTrip(t *testing.T) {
	providerPriv, _, providerPID := keyPair(t)
	_, _, viewerPID := keyPair(t)

	r := freshReceipt(providerPID, viewerPID)
	if err := r.SignAsProvider(providerPriv); err != nil {
		t.Fatalf("SignAsProvider: %v", err)
	}
	if err := r.VerifyProviderSig(); err != nil {
		t.Fatalf("VerifyProviderSig: %v", err)
	}
}

func TestVerifyBothHappyPath(t *testing.T) {
	viewerPriv, _, viewerPID := keyPair(t)
	providerPriv, _, providerPID := keyPair(t)

	r := freshReceipt(providerPID, viewerPID)
	if err := r.SignAsViewer(viewerPriv); err != nil {
		t.Fatalf("SignAsViewer: %v", err)
	}
	if err := r.SignAsProvider(providerPriv); err != nil {
		t.Fatalf("SignAsProvider: %v", err)
	}
	if err := r.VerifyBoth(); err != nil {
		t.Fatalf("VerifyBoth: %v", err)
	}
}

func TestVerifyRejectsTamperedField(t *testing.T) {
	viewerPriv, _, viewerPID := keyPair(t)
	providerPriv, _, providerPID := keyPair(t)

	r := freshReceipt(providerPID, viewerPID)
	_ = r.SignAsViewer(viewerPriv)
	_ = r.SignAsProvider(providerPriv)

	// Tamper with a field AFTER signing. Signatures over the old canonical
	// bytes must not validate anymore.
	r.SegmentSize *= 10

	if err := r.VerifyViewerSig(); err == nil {
		t.Fatal("viewer sig passed despite field tampering")
	}
	if err := r.VerifyProviderSig(); err == nil {
		t.Fatal("provider sig passed despite field tampering")
	}
}

func TestVerifyRejectsCrossSignerAttempt(t *testing.T) {
	// Attack: provider produces the viewer sig (impersonation). The
	// receipt's declared ViewerPeerID won't match the signing key's PeerID,
	// so verification must fail.
	providerPriv, _, providerPID := keyPair(t)
	_, _, viewerPID := keyPair(t) // unrelated identity

	r := freshReceipt(providerPID, viewerPID)
	if err := r.SignAsViewer(providerPriv); err != nil {
		t.Fatalf("unexpected sign error: %v", err)
	}
	if err := r.VerifyViewerSig(); err == nil {
		t.Fatal("cross-signer impersonation not detected")
	}
}

func TestVerifyRejectsMissingSig(t *testing.T) {
	_, _, providerPID := keyPair(t)
	_, _, viewerPID := keyPair(t)
	r := freshReceipt(providerPID, viewerPID)
	if err := r.VerifyViewerSig(); err == nil {
		t.Fatal("unsigned receipt passed viewer verification")
	}
	if err := r.VerifyProviderSig(); err == nil {
		t.Fatal("unsigned receipt passed provider verification")
	}
}

func TestHashIsDeterministic(t *testing.T) {
	_, _, providerPID := keyPair(t)
	_, _, viewerPID := keyPair(t)
	a := freshReceipt(providerPID, viewerPID)
	b := *a
	if !bytes.Equal(a.Hash(), b.Hash()) {
		t.Fatal("Hash differs for equal receipts")
	}
}
