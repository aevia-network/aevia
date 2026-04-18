package por_test

import (
	"bytes"
	"testing"

	"github.com/libp2p/go-libp2p/core/crypto"

	"github.com/Leeaandrob/aevia/services/provider-node/por"
)

// builder produces a dual-signed receipt with specific provider/viewer
// pairs and byte size.
type builder struct {
	providerPriv crypto.PrivKey
	providerPID  string
	viewerPriv   crypto.PrivKey
	viewerPID    string
}

func newBuilder(t *testing.T) builder {
	t.Helper()
	providerPriv, _, providerPID := keyPair(t)
	viewerPriv, _, viewerPID := keyPair(t)
	return builder{providerPriv, providerPID, viewerPriv, viewerPID}
}

func (b builder) receipt(t *testing.T, nonce uint64, size int, ts int64) *por.Receipt {
	t.Helper()
	r := &por.Receipt{
		ProviderPeerID: b.providerPID,
		ViewerPeerID:   b.viewerPID,
		CID:            "bafkaggregate",
		SegmentIndex:   int(nonce),
		SegmentSize:    size,
		TimestampUnix:  ts,
		Nonce:          nonce,
	}
	if err := r.SignAsViewer(b.viewerPriv); err != nil {
		t.Fatalf("sign viewer: %v", err)
	}
	if err := r.SignAsProvider(b.providerPriv); err != nil {
		t.Fatalf("sign provider: %v", err)
	}
	return r
}

func TestBuildSettlementRejectsEmpty(t *testing.T) {
	if _, err := por.BuildSettlement(nil); err == nil {
		t.Fatal("BuildSettlement(nil) returned nil error")
	}
}

func TestBuildSettlementSingleProvider(t *testing.T) {
	b := newBuilder(t)
	rs := []*por.Receipt{
		b.receipt(t, 1, 1024, 100),
		b.receipt(t, 2, 2048, 200),
		b.receipt(t, 3, 512, 300),
	}

	s, err := por.BuildSettlement(rs)
	if err != nil {
		t.Fatalf("BuildSettlement: %v", err)
	}
	if s.ReceiptCount != 3 {
		t.Fatalf("ReceiptCount = %d, want 3", s.ReceiptCount)
	}
	if s.TotalBytes != 1024+2048+512 {
		t.Fatalf("TotalBytes = %d", s.TotalBytes)
	}
	if len(s.Providers) != 1 || s.Providers[0] != b.providerPID {
		t.Fatalf("Providers = %v, want [%s]", s.Providers, b.providerPID)
	}
	if s.PerProviderBytes[0] != 1024+2048+512 {
		t.Fatalf("PerProviderBytes[0] = %d", s.PerProviderBytes[0])
	}
	if len(s.MerkleRoot) != 32 {
		t.Fatalf("MerkleRoot len = %d, want 32", len(s.MerkleRoot))
	}
}

func TestBuildSettlementPerProviderAccounting(t *testing.T) {
	b1 := newBuilder(t)
	b2 := newBuilder(t)

	rs := []*por.Receipt{
		b1.receipt(t, 1, 1000, 100),
		b1.receipt(t, 2, 2000, 200),
		b2.receipt(t, 1, 500, 150),
	}

	s, err := por.BuildSettlement(rs)
	if err != nil {
		t.Fatalf("BuildSettlement: %v", err)
	}
	if len(s.Providers) != 2 {
		t.Fatalf("Providers = %v, want 2 entries", s.Providers)
	}
	// Providers are sorted by PeerID; look up by map manually.
	bytesByProvider := map[string]uint64{}
	for i, p := range s.Providers {
		bytesByProvider[p] = s.PerProviderBytes[i]
	}
	if got := bytesByProvider[b1.providerPID]; got != 3000 {
		t.Fatalf("b1 bytes = %d, want 3000", got)
	}
	if got := bytesByProvider[b2.providerPID]; got != 500 {
		t.Fatalf("b2 bytes = %d, want 500", got)
	}
	if s.TotalBytes != 3500 {
		t.Fatalf("TotalBytes = %d, want 3500", s.TotalBytes)
	}
}

// TestBuildSettlementMerkleRootIsStableAcrossOrder proves the
// sort-then-hash Merkle root is independent of the order receipts were
// collected. Critical for multiple coordinators to produce the SAME root
// for the same epoch.
func TestBuildSettlementMerkleRootIsStableAcrossOrder(t *testing.T) {
	b := newBuilder(t)
	rs := []*por.Receipt{
		b.receipt(t, 1, 100, 100),
		b.receipt(t, 2, 200, 200),
		b.receipt(t, 3, 300, 300),
	}
	shuffled := []*por.Receipt{rs[2], rs[0], rs[1]}

	s1, err := por.BuildSettlement(rs)
	if err != nil {
		t.Fatalf("s1: %v", err)
	}
	s2, err := por.BuildSettlement(shuffled)
	if err != nil {
		t.Fatalf("s2: %v", err)
	}
	if !bytes.Equal(s1.MerkleRoot, s2.MerkleRoot) {
		t.Fatalf("Merkle roots differ across ordering: %x vs %x", s1.MerkleRoot, s2.MerkleRoot)
	}
}

func TestBuildSettlementRejectsDuplicate(t *testing.T) {
	b := newBuilder(t)
	r := b.receipt(t, 1, 100, 100)
	if _, err := por.BuildSettlement([]*por.Receipt{r, r}); err == nil {
		t.Fatal("BuildSettlement accepted duplicate receipt")
	}
}

func TestBuildSettlementRejectsTamperedReceipt(t *testing.T) {
	b := newBuilder(t)
	good := b.receipt(t, 1, 100, 100)
	tampered := b.receipt(t, 2, 100, 100)
	tampered.SegmentSize = 999 // invalidates the signature

	if _, err := por.BuildSettlement([]*por.Receipt{good, tampered}); err == nil {
		t.Fatal("BuildSettlement accepted tampered receipt")
	}
}
