package manifest_test

import (
	"bytes"
	"crypto/sha256"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

func TestHashLeafProducesSHA256(t *testing.T) {
	payload := []byte("hello aevia")
	got := manifest.HashLeaf(payload)
	want := sha256.Sum256(payload)
	if !bytes.Equal(got, want[:]) {
		t.Fatalf("HashLeaf != sha256: got=%x want=%x", got, want)
	}
	if len(got) != manifest.HashSize {
		t.Fatalf("HashLeaf length = %d, want %d", len(got), manifest.HashSize)
	}
}

func TestNewTreeRejectsEmpty(t *testing.T) {
	if _, err := manifest.NewTree(nil); err == nil {
		t.Fatal("NewTree(nil) returned nil error")
	}
	if _, err := manifest.NewTree([][]byte{}); err == nil {
		t.Fatal("NewTree([]) returned nil error")
	}
}

func TestNewTreeRejectsWrongLeafSize(t *testing.T) {
	_, err := manifest.NewTree([][]byte{make([]byte, 31)})
	if err == nil {
		t.Fatal("NewTree with 31-byte leaf returned nil error")
	}
}

func TestNewTreeSingleLeafRootEqualsLeaf(t *testing.T) {
	leaf := manifest.HashLeaf([]byte("solo"))
	tree, err := manifest.NewTree([][]byte{leaf})
	if err != nil {
		t.Fatalf("NewTree: %v", err)
	}
	if !bytes.Equal(tree.Root(), leaf) {
		t.Fatalf("single-leaf root != leaf: root=%x leaf=%x", tree.Root(), leaf)
	}
	if tree.LeafCount() != 1 {
		t.Fatalf("LeafCount = %d, want 1", tree.LeafCount())
	}
	if tree.Depth() != 1 {
		t.Fatalf("Depth = %d, want 1", tree.Depth())
	}
}

func TestNewTreeTwoLeavesRootIsConcatHash(t *testing.T) {
	a := manifest.HashLeaf([]byte("a"))
	b := manifest.HashLeaf([]byte("b"))
	tree, err := manifest.NewTree([][]byte{a, b})
	if err != nil {
		t.Fatalf("NewTree: %v", err)
	}
	h := sha256.New()
	h.Write(a)
	h.Write(b)
	want := h.Sum(nil)
	if !bytes.Equal(tree.Root(), want) {
		t.Fatalf("root mismatch:\n got=%x\nwant=%x", tree.Root(), want)
	}
	if tree.Depth() != 2 {
		t.Fatalf("Depth = %d, want 2", tree.Depth())
	}
}

func TestNewTreeOddCountDuplicatesLast(t *testing.T) {
	a := manifest.HashLeaf([]byte("a"))
	b := manifest.HashLeaf([]byte("b"))
	c := manifest.HashLeaf([]byte("c"))

	// Root formula for 3-leaf tree with duplicate-last:
	//   level 1 = [ H(a||b), H(c||c) ]
	//   root = H( H(a||b) || H(c||c) )
	level1Left := hashConcat(a, b)
	level1Right := hashConcat(c, c)
	wantRoot := hashConcat(level1Left, level1Right)

	tree, err := manifest.NewTree([][]byte{a, b, c})
	if err != nil {
		t.Fatalf("NewTree: %v", err)
	}
	if !bytes.Equal(tree.Root(), wantRoot) {
		t.Fatalf("3-leaf root mismatch:\n got=%x\nwant=%x", tree.Root(), wantRoot)
	}
}

func TestNewTreeFourLeavesBalancedRoot(t *testing.T) {
	leaves := [][]byte{
		manifest.HashLeaf([]byte("0")),
		manifest.HashLeaf([]byte("1")),
		manifest.HashLeaf([]byte("2")),
		manifest.HashLeaf([]byte("3")),
	}
	tree, err := manifest.NewTree(leaves)
	if err != nil {
		t.Fatalf("NewTree: %v", err)
	}
	l01 := hashConcat(leaves[0], leaves[1])
	l23 := hashConcat(leaves[2], leaves[3])
	want := hashConcat(l01, l23)
	if !bytes.Equal(tree.Root(), want) {
		t.Fatalf("4-leaf root mismatch:\n got=%x\nwant=%x", tree.Root(), want)
	}
}

func TestNewTreeRootIsDeterministic(t *testing.T) {
	leaves := tenLeaves()
	a, err := manifest.NewTree(leaves)
	if err != nil {
		t.Fatalf("NewTree a: %v", err)
	}
	b, err := manifest.NewTree(leaves)
	if err != nil {
		t.Fatalf("NewTree b: %v", err)
	}
	if !bytes.Equal(a.Root(), b.Root()) {
		t.Fatal("two trees over identical leaves produced different roots")
	}
}

func TestNewTreeMutatingInputDoesNotChangeRoot(t *testing.T) {
	leaves := tenLeaves()
	tree, err := manifest.NewTree(leaves)
	if err != nil {
		t.Fatalf("NewTree: %v", err)
	}
	rootBefore := tree.Root()

	// Mutate the caller-owned input. Defensive-copy must protect the tree.
	for i := range leaves[0] {
		leaves[0][i] ^= 0xFF
	}

	rootAfter := tree.Root()
	if !bytes.Equal(rootBefore, rootAfter) {
		t.Fatal("mutating input leaves changed tree root — defensive copy failed")
	}
}

func TestLeavesReturnsDefensiveCopy(t *testing.T) {
	leaves := tenLeaves()
	tree, err := manifest.NewTree(leaves)
	if err != nil {
		t.Fatalf("NewTree: %v", err)
	}
	snapshot := tree.Leaves()
	for i := range snapshot[0] {
		snapshot[0][i] = 0
	}
	// Second call must return untouched leaves.
	fresh := tree.Leaves()
	if bytes.Equal(fresh[0], make([]byte, manifest.HashSize)) {
		t.Fatal("Leaves() returned a reference that let callers mutate internal state")
	}
}

// helpers

func hashConcat(a, b []byte) []byte {
	h := sha256.New()
	h.Write(a)
	h.Write(b)
	return h.Sum(nil)
}

func tenLeaves() [][]byte {
	out := make([][]byte, 10)
	for i := 0; i < 10; i++ {
		out[i] = manifest.HashLeaf([]byte{byte(i)})
	}
	return out
}
