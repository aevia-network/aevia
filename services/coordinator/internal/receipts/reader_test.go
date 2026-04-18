package receipts_test

import (
	"crypto/rand"
	"testing"

	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"

	"github.com/Leeaandrob/aevia/services/coordinator/internal/receipts"
	"github.com/Leeaandrob/aevia/services/provider-node/por"
)

func keyPair(t *testing.T) (crypto.PrivKey, string) {
	t.Helper()
	priv, _, err := crypto.GenerateEd25519Key(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateEd25519Key: %v", err)
	}
	pub := priv.GetPublic()
	pid, err := peer.IDFromPublicKey(pub)
	if err != nil {
		t.Fatalf("IDFromPublicKey: %v", err)
	}
	return priv, pid.String()
}

func dualSigned(t *testing.T, providerPriv crypto.PrivKey, providerPID string, viewerPriv crypto.PrivKey, viewerPID string, nonce uint64, ts int64) *por.Receipt {
	t.Helper()
	r := &por.Receipt{
		ProviderPeerID: providerPID,
		ViewerPeerID:   viewerPID,
		CID:            "bafkreitest",
		SegmentIndex:   int(nonce),
		SegmentSize:    1024,
		TimestampUnix:  ts,
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

func TestOpenRejectsEmptyPath(t *testing.T) {
	if _, err := receipts.Open(""); err == nil {
		t.Fatal("Open(\"\") returned nil error")
	}
}

func TestInMemoryReaderWindowFiltersByTime(t *testing.T) {
	r, err := receipts.OpenInMemory()
	if err != nil {
		t.Fatalf("OpenInMemory: %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	providerPriv, providerPID := keyPair(t)
	viewerPriv, viewerPID := keyPair(t)
	rs := r.UnderlyingReceiptStore()

	for i, ts := range []int64{100, 200, 300} {
		rec := dualSigned(t, providerPriv, providerPID, viewerPriv, viewerPID, uint64(i+1), ts)
		if err := rs.Put(rec); err != nil {
			t.Fatalf("Put %d: %v", i, err)
		}
	}

	// Unbounded window: all three.
	all, err := r.WindowForAllProviders(0, 0)
	if err != nil {
		t.Fatalf("WindowForAllProviders unbounded: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("unbounded got %d, want 3", len(all))
	}

	// [150, 250): only ts=200.
	mid, err := r.WindowForAllProviders(150, 250)
	if err != nil {
		t.Fatalf("WindowForAllProviders mid: %v", err)
	}
	if len(mid) != 1 || mid[0].TimestampUnix != 200 {
		t.Fatalf("mid window = %v", mid)
	}

	// [250, 0) since-only: ts=300.
	tail, _ := r.WindowForAllProviders(250, 0)
	if len(tail) != 1 || tail[0].TimestampUnix != 300 {
		t.Fatalf("tail window = %v", tail)
	}
}

func TestMultiProviderWindowReturnsAll(t *testing.T) {
	r, err := receipts.OpenInMemory()
	if err != nil {
		t.Fatalf("OpenInMemory: %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	viewerPriv, viewerPID := keyPair(t)
	providerAPriv, providerAPID := keyPair(t)
	providerBPriv, providerBPID := keyPair(t)

	rs := r.UnderlyingReceiptStore()
	for i := 0; i < 3; i++ {
		_ = rs.Put(dualSigned(t, providerAPriv, providerAPID, viewerPriv, viewerPID, uint64(i+1), 100))
		_ = rs.Put(dualSigned(t, providerBPriv, providerBPID, viewerPriv, viewerPID, uint64(i+1), 100))
	}

	all, err := r.WindowForAllProviders(0, 0)
	if err != nil {
		t.Fatalf("WindowForAllProviders: %v", err)
	}
	if len(all) != 6 {
		t.Fatalf("multi-provider window = %d, want 6", len(all))
	}

	seen := map[string]int{}
	for _, rec := range all {
		seen[rec.ProviderPeerID]++
	}
	if seen[providerAPID] != 3 || seen[providerBPID] != 3 {
		t.Fatalf("per-provider counts wrong: %v", seen)
	}
}
