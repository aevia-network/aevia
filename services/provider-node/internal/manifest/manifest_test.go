package manifest_test

import (
	"bytes"
	"encoding/hex"
	"strings"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

func samplePayloads(t *testing.T) [][]byte {
	t.Helper()
	return [][]byte{
		[]byte("segment-00"),
		[]byte("segment-01"),
		[]byte("segment-02"),
		[]byte("segment-03"),
	}
}

func TestBuildFromPayloadsRejectsEmpty(t *testing.T) {
	if _, err := manifest.BuildFromPayloads(nil, 6); err == nil {
		t.Fatal("BuildFromPayloads(nil) returned nil error")
	}
}

func TestBuildFromPayloadsRejectsNonPositiveDuration(t *testing.T) {
	payloads := samplePayloads(t)
	if _, err := manifest.BuildFromPayloads(payloads, 0); err == nil {
		t.Fatal("BuildFromPayloads(duration=0) returned nil error")
	}
	if _, err := manifest.BuildFromPayloads(payloads, -1); err == nil {
		t.Fatal("BuildFromPayloads(duration=-1) returned nil error")
	}
}

func TestBuildFromPayloadsPopulatesAllFields(t *testing.T) {
	payloads := samplePayloads(t)
	m, err := manifest.BuildFromPayloads(payloads, 6)
	if err != nil {
		t.Fatalf("BuildFromPayloads: %v", err)
	}
	if m.Version != manifest.ManifestVersion {
		t.Errorf("version = %d, want %d", m.Version, manifest.ManifestVersion)
	}
	if m.SegmentCount != len(payloads) {
		t.Errorf("segment_count = %d, want %d", m.SegmentCount, len(payloads))
	}
	if m.SegmentDuration != 6 {
		t.Errorf("segment_duration = %d, want 6", m.SegmentDuration)
	}
	if len(m.Leaves) != len(payloads) {
		t.Errorf("len(leaves) = %d, want %d", len(m.Leaves), len(payloads))
	}
	if len(m.Root) != 64 {
		t.Errorf("root hex len = %d, want 64", len(m.Root))
	}
	if !strings.HasPrefix(m.CID, manifest.CIDv1Prefix) {
		t.Errorf("cid %q missing canonical prefix %q", m.CID, manifest.CIDv1Prefix)
	}
}

func TestManifestVerifySucceeds(t *testing.T) {
	m, err := manifest.BuildFromPayloads(samplePayloads(t), 6)
	if err != nil {
		t.Fatalf("BuildFromPayloads: %v", err)
	}
	if err := m.Verify(); err != nil {
		t.Fatalf("Verify: %v", err)
	}
}

func TestVerifyRejectsWrongVersion(t *testing.T) {
	m, _ := manifest.BuildFromPayloads(samplePayloads(t), 6)
	m.Version = 99
	if err := m.Verify(); err == nil {
		t.Fatal("Verify accepted wrong version")
	}
}

func TestVerifyRejectsSegmentCountMismatch(t *testing.T) {
	m, _ := manifest.BuildFromPayloads(samplePayloads(t), 6)
	m.SegmentCount++
	if err := m.Verify(); err == nil {
		t.Fatal("Verify accepted segment_count mismatch")
	}
}

func TestVerifyRejectsTamperedLeafHex(t *testing.T) {
	m, _ := manifest.BuildFromPayloads(samplePayloads(t), 6)
	// Flip one hex char in leaf[2].
	original := m.Leaves[2]
	if original[0] == 'a' {
		m.Leaves[2] = "b" + original[1:]
	} else {
		m.Leaves[2] = "a" + original[1:]
	}
	if err := m.Verify(); err == nil {
		t.Fatal("Verify accepted tampered leaf hex")
	}
}

func TestVerifyRejectsWrongRootHex(t *testing.T) {
	m, _ := manifest.BuildFromPayloads(samplePayloads(t), 6)
	m.Root = hex.EncodeToString(make([]byte, manifest.HashSize))
	if err := m.Verify(); err == nil {
		t.Fatal("Verify accepted wrong root")
	}
}

func TestVerifyRejectsWrongCID(t *testing.T) {
	m, _ := manifest.BuildFromPayloads(samplePayloads(t), 6)
	m.CID = manifest.CIDv1Prefix + "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
	if err := m.Verify(); err == nil {
		t.Fatal("Verify accepted wrong CID")
	}
}

func TestCanonicalJSONIsDeterministic(t *testing.T) {
	payloads := samplePayloads(t)
	m1, _ := manifest.BuildFromPayloads(payloads, 6)
	m2, _ := manifest.BuildFromPayloads(payloads, 6)

	j1, err := m1.CanonicalJSON()
	if err != nil {
		t.Fatalf("CanonicalJSON m1: %v", err)
	}
	j2, err := m2.CanonicalJSON()
	if err != nil {
		t.Fatalf("CanonicalJSON m2: %v", err)
	}
	if !bytes.Equal(j1, j2) {
		t.Fatalf("CanonicalJSON is not deterministic:\n%q\n%q", j1, j2)
	}
}

func TestCanonicalJSONRoundTrip(t *testing.T) {
	m, _ := manifest.BuildFromPayloads(samplePayloads(t), 6)
	j, err := m.CanonicalJSON()
	if err != nil {
		t.Fatalf("CanonicalJSON: %v", err)
	}
	parsed, err := manifest.ParseManifest(j)
	if err != nil {
		t.Fatalf("ParseManifest: %v", err)
	}
	if parsed.CID != m.CID || parsed.Root != m.Root || parsed.SegmentCount != m.SegmentCount {
		t.Fatalf("round-trip mismatch\norig=%+v\nparsed=%+v", m, parsed)
	}
	if err := parsed.Verify(); err != nil {
		t.Fatalf("round-tripped manifest failed Verify: %v", err)
	}
}

func TestLeafAtReturnsOriginalBytes(t *testing.T) {
	payloads := samplePayloads(t)
	m, _ := manifest.BuildFromPayloads(payloads, 6)
	for i, p := range payloads {
		got, err := m.LeafAt(i)
		if err != nil {
			t.Fatalf("LeafAt(%d): %v", i, err)
		}
		want := manifest.HashLeaf(p)
		if !bytes.Equal(got, want) {
			t.Fatalf("LeafAt(%d) = %x, want %x", i, got, want)
		}
	}
}

func TestLeafAtOutOfRange(t *testing.T) {
	m, _ := manifest.BuildFromPayloads(samplePayloads(t), 6)
	for _, idx := range []int{-1, 4, 100} {
		if _, err := m.LeafAt(idx); err == nil {
			t.Errorf("LeafAt(%d) returned nil error", idx)
		}
	}
}
