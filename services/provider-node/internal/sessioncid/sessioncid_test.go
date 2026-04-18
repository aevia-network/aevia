package sessioncid_test

import (
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/sessioncid"
)

func TestOfDeterministic(t *testing.T) {
	got1, err := sessioncid.Of("s_1776518436002962024")
	if err != nil {
		t.Fatalf("Of: %v", err)
	}
	got2, err := sessioncid.Of("s_1776518436002962024")
	if err != nil {
		t.Fatalf("Of second call: %v", err)
	}
	if got1 != got2 {
		t.Fatalf("non-deterministic: %s vs %s", got1, got2)
	}
	if got1 == "" {
		t.Fatalf("empty CID returned")
	}
	// CIDv1 raw-codec + sha256 multihash starts with "bafk" in base32.
	if got1[:4] != "bafk" {
		t.Fatalf("expected CIDv1 base32 bafk prefix, got %q", got1)
	}
}

func TestOfDifferentInputsDifferentCIDs(t *testing.T) {
	a, _ := sessioncid.Of("s_1")
	b, _ := sessioncid.Of("s_2")
	if a == b {
		t.Fatalf("different inputs collided to same CID: %s", a)
	}
}

func TestOfEmpty(t *testing.T) {
	if _, err := sessioncid.Of(""); err == nil {
		t.Fatalf("expected error on empty sessionID")
	}
}

// TestCrossLangDeterminism pins the Go output so the JS helper in
// apps/video/src/lib/mesh/resolve.ts stays in sync. If this value
// changes, update the JS side (and vice-versa) — the two must match
// byte-for-byte or DHT resolve collapses silently.
func TestCrossLangDeterminism(t *testing.T) {
	const want = "bafkreicqrjlvczmpd264cw62dtlvons4fqc7usjat7mh7gcg7rplbppc7m"
	got, err := sessioncid.Of("s_1776518436002962024")
	if err != nil {
		t.Fatalf("Of: %v", err)
	}
	if got != want {
		t.Fatalf("CID drift — Go=%s want=%s. If JS changed, update both sides.", got, want)
	}
}
