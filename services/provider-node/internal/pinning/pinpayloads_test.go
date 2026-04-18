package pinning_test

import (
	"bytes"
	"crypto/rand"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
)

func TestPinPayloadsRejectsEmpty(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)
	if _, err := cs.PinPayloads(nil, 6); err == nil {
		t.Fatal("PinPayloads(nil) returned nil error")
	}
	if _, err := cs.PinPayloads([][]byte{}, 6); err == nil {
		t.Fatal("PinPayloads([]) returned nil error")
	}
}

func TestPinPayloadsReturnsConsistentManifest(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)

	payloads := make([][]byte, 5)
	for i := range payloads {
		payloads[i] = make([]byte, 256)
		_, _ = rand.Read(payloads[i])
	}

	m, err := cs.PinPayloads(payloads, 6)
	if err != nil {
		t.Fatalf("PinPayloads: %v", err)
	}
	if err := m.Verify(); err != nil {
		t.Fatalf("returned manifest fails Verify: %v", err)
	}
	if m.SegmentCount != 5 {
		t.Fatalf("SegmentCount = %d, want 5", m.SegmentCount)
	}

	// Round-trip: every segment must come back byte-identical.
	for i, want := range payloads {
		got, err := cs.GetSegment(m.CID, i)
		if err != nil {
			t.Fatalf("GetSegment(%d): %v", i, err)
		}
		if !bytes.Equal(got, want) {
			t.Fatalf("segment %d round-trip mismatch", i)
		}
	}
}

// TestPinPayloadsIsDeterministicCIDPerInputs asserts the Pin flow preserves
// content-addressing: pinning the same bytes twice (even on different
// stores) produces the same CID.
func TestPinPayloadsIsDeterministicCIDPerInputs(t *testing.T) {
	payloads := [][]byte{[]byte("a"), []byte("b"), []byte("c")}

	csA := pinning.NewContentStore(newMemStore(t))
	csB := pinning.NewContentStore(newMemStore(t))

	mA, err := csA.PinPayloads(payloads, 6)
	if err != nil {
		t.Fatalf("csA: %v", err)
	}
	mB, err := csB.PinPayloads(payloads, 6)
	if err != nil {
		t.Fatalf("csB: %v", err)
	}
	if mA.CID != mB.CID {
		t.Fatalf("CIDs differ across stores for identical inputs: %s vs %s", mA.CID, mB.CID)
	}
}
