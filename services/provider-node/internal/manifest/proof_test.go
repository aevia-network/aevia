package manifest_test

import (
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

func buildTreeForTest(t *testing.T, n int) (*manifest.Tree, [][]byte) {
	t.Helper()
	leaves := make([][]byte, n)
	for i := 0; i < n; i++ {
		leaves[i] = manifest.HashLeaf([]byte{byte(i)})
	}
	tree, err := manifest.NewTree(leaves)
	if err != nil {
		t.Fatalf("NewTree(%d): %v", n, err)
	}
	return tree, leaves
}

func TestProofRejectsOutOfRangeIndex(t *testing.T) {
	tree, _ := buildTreeForTest(t, 4)
	for _, idx := range []int{-1, 4, 100} {
		if _, err := tree.Proof(idx); err == nil {
			t.Errorf("Proof(%d) returned nil error", idx)
		}
	}
}

func TestProofSingleLeafHasEmptySteps(t *testing.T) {
	tree, leaves := buildTreeForTest(t, 1)
	proof, err := tree.Proof(0)
	if err != nil {
		t.Fatalf("Proof(0): %v", err)
	}
	if len(proof.Steps) != 0 {
		t.Fatalf("single-leaf proof has %d steps, want 0", len(proof.Steps))
	}
	if err := manifest.VerifyProof(tree.Root(), leaves[0], proof); err != nil {
		t.Fatalf("VerifyProof: %v", err)
	}
}

func TestProofVerifiesAllIndicesBalanced(t *testing.T) {
	for _, n := range []int{2, 4, 8, 16, 32} {
		tree, leaves := buildTreeForTest(t, n)
		root := tree.Root()
		for i := 0; i < n; i++ {
			proof, err := tree.Proof(i)
			if err != nil {
				t.Fatalf("n=%d Proof(%d): %v", n, i, err)
			}
			if err := manifest.VerifyProof(root, leaves[i], proof); err != nil {
				t.Fatalf("n=%d VerifyProof(%d): %v", n, i, err)
			}
		}
	}
}

func TestProofVerifiesAllIndicesOddCounts(t *testing.T) {
	for _, n := range []int{3, 5, 7, 9, 10, 13} {
		tree, leaves := buildTreeForTest(t, n)
		root := tree.Root()
		for i := 0; i < n; i++ {
			proof, err := tree.Proof(i)
			if err != nil {
				t.Fatalf("n=%d Proof(%d): %v", n, i, err)
			}
			if err := manifest.VerifyProof(root, leaves[i], proof); err != nil {
				t.Fatalf("n=%d VerifyProof(%d): %v", n, i, err)
			}
		}
	}
}

func TestVerifyProofRejectsTamperedLeaf(t *testing.T) {
	tree, leaves := buildTreeForTest(t, 8)
	root := tree.Root()
	proof, err := tree.Proof(3)
	if err != nil {
		t.Fatalf("Proof: %v", err)
	}

	tampered := append([]byte(nil), leaves[3]...)
	tampered[0] ^= 0x01

	if err := manifest.VerifyProof(root, tampered, proof); err == nil {
		t.Fatal("VerifyProof accepted tampered leaf")
	}
}

func TestVerifyProofRejectsTamperedStep(t *testing.T) {
	tree, leaves := buildTreeForTest(t, 8)
	root := tree.Root()
	proof, err := tree.Proof(3)
	if err != nil {
		t.Fatalf("Proof: %v", err)
	}

	proof.Steps[0].Hash[0] ^= 0xFF

	if err := manifest.VerifyProof(root, leaves[3], proof); err == nil {
		t.Fatal("VerifyProof accepted tampered sibling hash")
	}
}

func TestVerifyProofRejectsWrongRoot(t *testing.T) {
	tree, leaves := buildTreeForTest(t, 8)
	proof, err := tree.Proof(3)
	if err != nil {
		t.Fatalf("Proof: %v", err)
	}

	wrongRoot := manifest.HashLeaf([]byte("not the root"))

	if err := manifest.VerifyProof(wrongRoot, leaves[3], proof); err == nil {
		t.Fatal("VerifyProof accepted wrong root")
	}
}

func TestVerifyProofGuardsInputs(t *testing.T) {
	tree, leaves := buildTreeForTest(t, 4)
	proof, _ := tree.Proof(0)

	if err := manifest.VerifyProof(nil, leaves[0], proof); err == nil {
		t.Error("VerifyProof(nil root) returned nil error")
	}
	if err := manifest.VerifyProof(tree.Root(), nil, proof); err == nil {
		t.Error("VerifyProof(nil leaf) returned nil error")
	}
	if err := manifest.VerifyProof(tree.Root(), leaves[0], nil); err == nil {
		t.Error("VerifyProof(nil proof) returned nil error")
	}
}
