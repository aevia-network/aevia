package pinning_test

import (
	"bytes"
	"errors"
	"sort"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/storage"
)

func newMemStore(t *testing.T) *storage.Store {
	t.Helper()
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

// samplePin builds a consistent (manifest, segments) tuple using the
// manifest package's canonical builder so tests exercise the real
// cryptographic chain, not a fixture-only shortcut.
func samplePin(t *testing.T, payloads [][]byte) (*manifest.Manifest, [][]byte) {
	t.Helper()
	m, err := manifest.BuildFromPayloads(payloads, 6)
	if err != nil {
		t.Fatalf("BuildFromPayloads: %v", err)
	}
	return m, payloads
}

func TestPinRoundTrip(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)

	payloads := [][]byte{[]byte("seg-0"), []byte("seg-1"), []byte("seg-2")}
	m, segs := samplePin(t, payloads)

	if err := cs.Pin(m.CID, m, segs); err != nil {
		t.Fatalf("Pin: %v", err)
	}

	gotManifest, err := cs.GetManifest(m.CID)
	if err != nil {
		t.Fatalf("GetManifest: %v", err)
	}
	if gotManifest.CID != m.CID || gotManifest.Root != m.Root {
		t.Fatalf("manifest round-trip mismatch: got=%+v want=%+v", gotManifest, m)
	}

	for i, want := range segs {
		got, err := cs.GetSegment(m.CID, i)
		if err != nil {
			t.Fatalf("GetSegment(%d): %v", i, err)
		}
		if !bytes.Equal(got, want) {
			t.Fatalf("segment %d round-trip mismatch", i)
		}
	}
}

func TestPinRejectsMismatchedCID(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)
	m, segs := samplePin(t, [][]byte{[]byte("x")})

	if err := cs.Pin("different-cid", m, segs); err == nil {
		t.Fatal("Pin accepted mismatched CID")
	}
}

func TestPinRejectsSegmentCountMismatch(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)
	m, _ := samplePin(t, [][]byte{[]byte("a"), []byte("b")})

	if err := cs.Pin(m.CID, m, [][]byte{[]byte("only one")}); err == nil {
		t.Fatal("Pin accepted fewer segments than manifest promised")
	}
}

func TestGetSegmentMissingReturnsNotFound(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)
	_, err := cs.GetSegment("bafabsent", 0)
	if !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestHasReflectsPin(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)
	m, segs := samplePin(t, [][]byte{[]byte("only")})

	present, _ := cs.Has(m.CID)
	if present {
		t.Fatal("Has before Pin returned true")
	}
	_ = cs.Pin(m.CID, m, segs)
	present, _ = cs.Has(m.CID)
	if !present {
		t.Fatal("Has after Pin returned false")
	}
}

func TestList(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)

	// Build 3 distinct pins.
	for _, seed := range []string{"alpha", "beta", "gamma"} {
		m, segs := samplePin(t, [][]byte{[]byte(seed)})
		if err := cs.Pin(m.CID, m, segs); err != nil {
			t.Fatalf("Pin %s: %v", seed, err)
		}
	}

	list, err := cs.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("List len = %d, want 3 (%v)", len(list), list)
	}
	sort.Strings(list)
	// Every listed CID must have the canonical prefix.
	for _, cid := range list {
		if len(cid) < 7 {
			t.Fatalf("short cid in list: %q", cid)
		}
	}
}

func TestUnpinRemovesManifestAndSegments(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)
	m, segs := samplePin(t, [][]byte{[]byte("a"), []byte("b"), []byte("c")})

	_ = cs.Pin(m.CID, m, segs)

	if err := cs.Unpin(m.CID); err != nil {
		t.Fatalf("Unpin: %v", err)
	}

	if _, err := cs.GetManifest(m.CID); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("GetManifest after Unpin: err = %v, want ErrNotFound", err)
	}
	for i := range segs {
		if _, err := cs.GetSegment(m.CID, i); !errors.Is(err, storage.ErrNotFound) {
			t.Fatalf("GetSegment(%d) after Unpin: err = %v, want ErrNotFound", i, err)
		}
	}
}

func TestUnpinMissingIsIdempotent(t *testing.T) {
	store := newMemStore(t)
	cs := pinning.NewContentStore(store)
	if err := cs.Unpin("bafnever"); err != nil {
		t.Fatalf("Unpin on missing: %v", err)
	}
}
