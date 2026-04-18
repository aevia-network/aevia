package por_test

import (
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/por"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/storage"
)

func newStore(t *testing.T) *por.ReceiptStore {
	t.Helper()
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return por.NewReceiptStore(s)
}

func signedReceipt(t *testing.T, nonce uint64, ts int64) *por.Receipt {
	t.Helper()
	viewerPriv, _, viewerPID := keyPair(t)
	providerPriv, _, providerPID := keyPair(t)
	r := &por.Receipt{
		ProviderPeerID: providerPID,
		ViewerPeerID:   viewerPID,
		CID:            "bafktest",
		SegmentIndex:   0,
		SegmentSize:    1024,
		TimestampUnix:  ts,
		Nonce:          nonce,
	}
	if err := r.SignAsViewer(viewerPriv); err != nil {
		t.Fatalf("sign viewer: %v", err)
	}
	if err := r.SignAsProvider(providerPriv); err != nil {
		t.Fatalf("sign provider: %v", err)
	}
	return r
}

func TestReceiptStorePutAndList(t *testing.T) {
	rs := newStore(t)
	r := signedReceipt(t, 1, time.Now().Unix())
	if err := rs.Put(r); err != nil {
		t.Fatalf("Put: %v", err)
	}
	all, err := rs.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("List len = %d, want 1", len(all))
	}
	if all[0].Nonce != 1 {
		t.Fatalf("Nonce = %d, want 1", all[0].Nonce)
	}
}

func TestReceiptStoreGetByProviderFiltersByTime(t *testing.T) {
	rs := newStore(t)
	now := time.Now().Unix()
	// Three receipts from the SAME provider across 3 timestamps. We craft
	// them manually (bypassing signedReceipt) so the provider PID matches.
	viewerPriv, _, viewerPID := keyPair(t)
	providerPriv, _, providerPID := keyPair(t)

	for i, ts := range []int64{now - 100, now, now + 100} {
		r := &por.Receipt{
			ProviderPeerID: providerPID,
			ViewerPeerID:   viewerPID,
			CID:            "bafktest",
			SegmentIndex:   i,
			SegmentSize:    1024,
			TimestampUnix:  ts,
			Nonce:          uint64(i + 1),
		}
		_ = r.SignAsViewer(viewerPriv)
		_ = r.SignAsProvider(providerPriv)
		if err := rs.Put(r); err != nil {
			t.Fatalf("Put %d: %v", i, err)
		}
	}

	// Window [now-50, now+50) should yield exactly the middle receipt.
	got, err := rs.GetByProvider(providerPID, now-50, now+50)
	if err != nil {
		t.Fatalf("GetByProvider: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("window got %d receipts, want 1", len(got))
	}
	if got[0].TimestampUnix != now {
		t.Fatalf("timestamp = %d, want %d", got[0].TimestampUnix, now)
	}

	// No window = everything.
	all, _ := rs.GetByProvider(providerPID, 0, 0)
	if len(all) != 3 {
		t.Fatalf("unbounded got %d, want 3", len(all))
	}
}

func TestReceiptStoreReturnsInTimeOrder(t *testing.T) {
	rs := newStore(t)
	viewerPriv, _, viewerPID := keyPair(t)
	providerPriv, _, providerPID := keyPair(t)

	// Insert out of order — store should still return ascending.
	timestamps := []int64{300, 100, 200}
	for i, ts := range timestamps {
		r := &por.Receipt{
			ProviderPeerID: providerPID,
			ViewerPeerID:   viewerPID,
			CID:            "bafkorder",
			SegmentIndex:   i,
			SegmentSize:    1,
			TimestampUnix:  ts,
			Nonce:          uint64(i),
		}
		_ = r.SignAsViewer(viewerPriv)
		_ = r.SignAsProvider(providerPriv)
		if err := rs.Put(r); err != nil {
			t.Fatalf("Put: %v", err)
		}
	}
	got, err := rs.GetByProvider(providerPID, 0, 0)
	if err != nil {
		t.Fatalf("GetByProvider: %v", err)
	}
	want := []int64{100, 200, 300}
	if len(got) != len(want) {
		t.Fatalf("len = %d, want %d", len(got), len(want))
	}
	for i, w := range want {
		if got[i].TimestampUnix != w {
			t.Fatalf("index %d: ts = %d, want %d", i, got[i].TimestampUnix, w)
		}
	}
}

func TestReceiptStoreDelete(t *testing.T) {
	rs := newStore(t)
	r := signedReceipt(t, 7, time.Now().Unix())
	if err := rs.Put(r); err != nil {
		t.Fatalf("Put: %v", err)
	}
	if err := rs.Delete(r); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	all, _ := rs.List()
	if len(all) != 0 {
		t.Fatalf("List after Delete: %d, want 0", len(all))
	}
}

func TestReceiptStoreRejectsMissingProvider(t *testing.T) {
	rs := newStore(t)
	r := &por.Receipt{SegmentSize: 100}
	if err := rs.Put(r); err == nil {
		t.Fatal("Put accepted receipt without ProviderPeerID")
	}
}
