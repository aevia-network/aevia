package whip

import (
	"bytes"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

func newPinStore(t *testing.T) *pinning.ContentStore {
	t.Helper()
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("storage.Open: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return pinning.NewContentStore(s)
}

func TestLivePinSinkAppendsLeavesInOrder(t *testing.T) {
	sink, err := NewLivePinSink(newPinStore(t), "s_test")
	if err != nil {
		t.Fatalf("NewLivePinSink: %v", err)
	}

	// Init segment is required before media, tests the guard.
	if err := sink.OnInitSegment([]byte("init-fmp4")); err != nil {
		t.Fatalf("OnInitSegment: %v", err)
	}

	for i := uint32(0); i < 3; i++ {
		body := []byte{byte(i), byte(i), byte(i)}
		if err := sink.OnMediaSegment(i, body, 180_000); err != nil {
			t.Fatalf("OnMediaSegment[%d]: %v", i, err)
		}
	}

	snap, err := sink.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}
	if snap.SegmentCount != 3 {
		t.Fatalf("SegmentCount = %d, want 3", snap.SegmentCount)
	}
	if snap.RootHex == "" {
		t.Fatal("RootHex empty")
	}
	if snap.CID == "" || snap.CID[:7] != "bafkrei" {
		t.Fatalf("CID = %q, want bafkrei prefix", snap.CID)
	}
	if !bytes.Equal(snap.InitSegment, []byte("init-fmp4")) {
		t.Fatalf("InitSegment mismatch")
	}
}

func TestLivePinSinkRejectsOutOfOrderIndex(t *testing.T) {
	sink, _ := NewLivePinSink(newPinStore(t), "s_test")
	_ = sink.OnInitSegment([]byte("init"))
	_ = sink.OnMediaSegment(0, []byte("a"), 90000)
	// Caller sends index 5 when index 1 was expected — must reject.
	if err := sink.OnMediaSegment(5, []byte("z"), 90000); err == nil {
		t.Fatal("OnMediaSegment accepted out-of-order index")
	}
}

func TestLivePinSinkFinalizeReturnsValidManifest(t *testing.T) {
	store := newPinStore(t)
	sink, _ := NewLivePinSink(store, "s_final")
	_ = sink.OnInitSegment([]byte("init"))
	for i := uint32(0); i < 3; i++ {
		_ = sink.OnMediaSegment(i, []byte{byte(i + 1), 0, 0, 0}, 90000)
	}

	m, err := sink.Finalize(6)
	if err != nil {
		t.Fatalf("Finalize: %v", err)
	}
	if err := m.Verify(); err != nil {
		t.Fatalf("final manifest Verify: %v", err)
	}
	if m.SegmentCount != 3 {
		t.Fatalf("SegmentCount = %d, want 3", m.SegmentCount)
	}

	// Round-trip: pinned content must come back byte-identical.
	for i := 0; i < 3; i++ {
		seg, err := store.GetSegment(m.CID, i)
		if err != nil {
			t.Fatalf("GetSegment %d: %v", i, err)
		}
		if !bytes.Equal(seg, []byte{byte(i + 1), 0, 0, 0}) {
			t.Fatalf("segment %d mismatch", i)
		}
	}
}

func TestLivePinSinkRejectsNilStore(t *testing.T) {
	if _, err := NewLivePinSink(nil, "s_x"); err == nil {
		t.Fatal("NewLivePinSink(nil) returned nil error")
	}
}

func TestLivePinSinkRejectsEmptySessionID(t *testing.T) {
	if _, err := NewLivePinSink(newPinStore(t), ""); err == nil {
		t.Fatal("NewLivePinSink(\"\") returned nil error")
	}
}

func TestLivePinSinkSegmentBytesReturnsByIndex(t *testing.T) {
	sink, _ := NewLivePinSink(newPinStore(t), "s_bytes")
	_ = sink.OnInitSegment([]byte("init"))
	_ = sink.OnMediaSegment(0, []byte("seg-0"), 90000)
	_ = sink.OnMediaSegment(1, []byte("seg-1"), 90000)

	b, err := sink.SegmentBytes(1)
	if err != nil {
		t.Fatalf("SegmentBytes: %v", err)
	}
	if !bytes.Equal(b, []byte("seg-1")) {
		t.Fatalf("SegmentBytes = %q", b)
	}
	if _, err := sink.SegmentBytes(10); err == nil {
		t.Fatal("SegmentBytes(10) on 2-segment sink returned nil error")
	}
}
