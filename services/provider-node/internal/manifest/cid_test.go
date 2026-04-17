package manifest_test

import (
	"bytes"
	"crypto/sha256"
	"strings"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

func TestCIDv1RawRejectsWrongLength(t *testing.T) {
	if _, err := manifest.CIDv1Raw(make([]byte, 31)); err == nil {
		t.Fatal("CIDv1Raw(31 bytes) returned nil error")
	}
	if _, err := manifest.CIDv1Raw(nil); err == nil {
		t.Fatal("CIDv1Raw(nil) returned nil error")
	}
}

func TestCIDv1RawAlwaysStartsWithCanonicalPrefix(t *testing.T) {
	digest := sha256.Sum256([]byte("aevia"))
	cid, err := manifest.CIDv1Raw(digest[:])
	if err != nil {
		t.Fatalf("CIDv1Raw: %v", err)
	}
	if !strings.HasPrefix(cid, manifest.CIDv1Prefix) {
		t.Fatalf("CID %q missing canonical prefix %q", cid, manifest.CIDv1Prefix)
	}
}

func TestCIDv1RawLengthIsConstant(t *testing.T) {
	// base32 lowercase no-padding of 36 bytes = 58 chars. Plus 'b' prefix = 59.
	digest := sha256.Sum256([]byte("len-check"))
	cid, err := manifest.CIDv1Raw(digest[:])
	if err != nil {
		t.Fatalf("CIDv1Raw: %v", err)
	}
	if len(cid) != 59 {
		t.Fatalf("CID len = %d, want 59 (%q)", len(cid), cid)
	}
}

func TestCIDv1RawIsLowercase(t *testing.T) {
	digest := sha256.Sum256([]byte("case-check"))
	cid, err := manifest.CIDv1Raw(digest[:])
	if err != nil {
		t.Fatalf("CIDv1Raw: %v", err)
	}
	if cid != strings.ToLower(cid) {
		t.Fatalf("CID %q is not all lowercase", cid)
	}
}

func TestCIDv1RoundTripRestoresDigest(t *testing.T) {
	for i := 0; i < 8; i++ {
		digest := sha256.Sum256([]byte{byte(i), byte(i * 7), byte(i * 13)})
		cid, err := manifest.CIDv1Raw(digest[:])
		if err != nil {
			t.Fatalf("CIDv1Raw[%d]: %v", i, err)
		}
		got, err := manifest.DecodeCIDv1Raw(cid)
		if err != nil {
			t.Fatalf("DecodeCIDv1Raw[%d]: %v", i, err)
		}
		if !bytes.Equal(got, digest[:]) {
			t.Fatalf("[%d] round-trip mismatch: got=%x want=%x", i, got, digest)
		}
	}
}

func TestDecodeCIDv1RawRejectsMissingMultibasePrefix(t *testing.T) {
	if _, err := manifest.DecodeCIDv1Raw("afkreiabc"); err == nil {
		t.Fatal("DecodeCIDv1Raw without 'b' prefix returned nil error")
	}
}

func TestDecodeCIDv1RawRejectsTruncated(t *testing.T) {
	// "bafkrei" alone is only the header with nothing after.
	if _, err := manifest.DecodeCIDv1Raw(manifest.CIDv1Prefix); err == nil {
		t.Fatal("DecodeCIDv1Raw(prefix only) returned nil error")
	}
}

func TestDecodeCIDv1RawRejectsBadBase32(t *testing.T) {
	if _, err := manifest.DecodeCIDv1Raw("b!!!"); err == nil {
		t.Fatal("DecodeCIDv1Raw(bad base32) returned nil error")
	}
}

func TestMustCIDv1RawPanicsOnInvalid(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("MustCIDv1Raw did not panic on 0-length digest")
		}
	}()
	_ = manifest.MustCIDv1Raw(nil)
}

// Cross-check against the tree root produced by NewTree + HashLeaf. This
// asserts the CID encoding is stable across the full chain segments ->
// leaves -> merkle tree -> root -> CID.
func TestTreeRootEncodesToStableCID(t *testing.T) {
	payloads := [][]byte{
		[]byte("hello"),
		[]byte("aevia"),
		[]byte("kill test"),
		[]byte("persistence"),
	}
	leaves := make([][]byte, len(payloads))
	for i, p := range payloads {
		leaves[i] = manifest.HashLeaf(p)
	}
	tree, err := manifest.NewTree(leaves)
	if err != nil {
		t.Fatalf("NewTree: %v", err)
	}
	cid, err := manifest.CIDv1Raw(tree.Root())
	if err != nil {
		t.Fatalf("CIDv1Raw: %v", err)
	}
	recovered, err := manifest.DecodeCIDv1Raw(cid)
	if err != nil {
		t.Fatalf("DecodeCIDv1Raw: %v", err)
	}
	if !bytes.Equal(recovered, tree.Root()) {
		t.Fatalf("CID round-trip did not restore root:\n got=%x\nwant=%x", recovered, tree.Root())
	}
}
