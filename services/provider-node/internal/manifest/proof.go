package manifest

import (
	"bytes"
	"crypto/sha256"
	"fmt"
)

// ProofStep is one node sibling on the path from leaf to root. When verifying,
// Right=true means the sibling is on the right of the currently-walked node,
// so the next hash is SHA-256(current || sibling). Right=false means the
// sibling is on the left, so hashing order flips.
type ProofStep struct {
	Hash  []byte
	Right bool
}

// Proof is a Merkle inclusion proof for a single leaf.
type Proof struct {
	Steps []ProofStep
	Index int
	Count int // total leaves in the original tree — needed to validate Index
}

// Proof computes an inclusion proof for the leaf at the given index.
func (t *Tree) Proof(index int) (*Proof, error) {
	if index < 0 || index >= t.LeafCount() {
		return nil, fmt.Errorf("manifest: proof index %d out of range [0,%d)", index, t.LeafCount())
	}

	steps := make([]ProofStep, 0, len(t.levels)-1)
	pos := index
	for lvl := 0; lvl < len(t.levels)-1; lvl++ {
		level := t.levels[lvl]
		var siblingHash []byte
		var siblingOnRight bool

		if pos%2 == 0 {
			// Current node is a left child — sibling (if any) is pos+1.
			if pos+1 < len(level) {
				siblingHash = level[pos+1]
			} else {
				// Odd-count level: the tree duplicates the last node as its
				// own sibling during construction.
				siblingHash = level[pos]
			}
			siblingOnRight = true
		} else {
			// Current node is a right child — sibling is pos-1.
			siblingHash = level[pos-1]
			siblingOnRight = false
		}

		steps = append(steps, ProofStep{
			Hash:  append([]byte(nil), siblingHash...),
			Right: siblingOnRight,
		})
		pos /= 2
	}

	return &Proof{
		Steps: steps,
		Index: index,
		Count: t.LeafCount(),
	}, nil
}

// VerifyProof returns nil if the proof is valid for (root, leaf). leaf must
// be the 32-byte leaf digest (as produced by HashLeaf), not the raw payload.
func VerifyProof(root, leaf []byte, proof *Proof) error {
	if proof == nil {
		return fmt.Errorf("manifest: nil proof")
	}
	if len(root) != HashSize {
		return fmt.Errorf("manifest: root has len %d, want %d", len(root), HashSize)
	}
	if len(leaf) != HashSize {
		return fmt.Errorf("manifest: leaf has len %d, want %d", len(leaf), HashSize)
	}
	if proof.Index < 0 || proof.Index >= proof.Count {
		return fmt.Errorf("manifest: proof index %d out of range [0,%d)", proof.Index, proof.Count)
	}
	for i, step := range proof.Steps {
		if len(step.Hash) != HashSize {
			return fmt.Errorf("manifest: proof step %d has len %d, want %d", i, len(step.Hash), HashSize)
		}
	}

	current := append([]byte(nil), leaf...)
	for _, step := range proof.Steps {
		h := sha256.New()
		if step.Right {
			h.Write(current)
			h.Write(step.Hash)
		} else {
			h.Write(step.Hash)
			h.Write(current)
		}
		current = h.Sum(nil)
	}

	if !bytes.Equal(current, root) {
		return fmt.Errorf("manifest: recomputed root %x does not match expected %x", current, root)
	}
	return nil
}
