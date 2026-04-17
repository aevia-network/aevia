// Package manifest builds and verifies the cryptographic manifest that
// anchors Aevia content. A manifest is a Merkle-SHA-256 tree over the
// per-segment payload hashes, wrapped in a CIDv1. The root CID is what gets
// written to ContentRegistry on Base — the on-chain anchor — so any viewer
// can reconstruct trust from (peerID, cidRoot) alone:
//
//   1. Fetch the manifest from the peer (any transport).
//   2. Recompute the Merkle root from the manifest leaves.
//   3. Assert the recomputed root equals the on-chain cidRoot.
//   4. Fetch each segment. Compare SHA-256 against the corresponding leaf.
//
// Tampering at any layer (transport, storage, relay, MITM) breaks step 2, 3,
// or 4 deterministically. This file implements the tree primitive; higher
// levels (CIDv1 encoding, manifest JSON, verification flow) build on top.
package manifest

import (
	"crypto/sha256"
	"errors"
	"fmt"
)

// HashSize is the byte length of a SHA-256 digest.
const HashSize = sha256.Size

// HashLeaf returns SHA-256(payload). Callers hash their raw segment bytes
// through this helper before feeding leaves into NewTree.
func HashLeaf(payload []byte) []byte {
	sum := sha256.Sum256(payload)
	return sum[:]
}

// Tree is a binary Merkle tree over SHA-256 leaves.
//
// Layout choices (documented here so protocol spec RFC-2-content-addressing
// stays in sync):
//   - Leaves are raw SHA-256 digests of segment payloads (32 bytes each).
//   - Internal nodes = SHA-256(left || right).
//   - When a level has an odd count, the last element is duplicated
//     (cloned, not re-hashed) so pairs always exist.
//   - A single-leaf tree has the leaf itself as root.
type Tree struct {
	leaves [][]byte   // leaf hashes (32 bytes each), copied on construction
	levels [][][]byte // levels[0] = leaves, levels[len-1] = [root]
}

// NewTree builds a Merkle tree from precomputed leaf digests. Each leaf MUST
// be HashSize bytes. Input is defensively copied.
func NewTree(leaves [][]byte) (*Tree, error) {
	if len(leaves) == 0 {
		return nil, errors.New("manifest: merkle tree requires at least 1 leaf")
	}
	for i, l := range leaves {
		if len(l) != HashSize {
			return nil, fmt.Errorf("manifest: leaf %d has len %d, want %d", i, len(l), HashSize)
		}
	}

	cp := make([][]byte, len(leaves))
	for i, l := range leaves {
		c := make([]byte, HashSize)
		copy(c, l)
		cp[i] = c
	}

	t := &Tree{
		leaves: cp,
		levels: [][][]byte{cp},
	}

	current := cp
	for len(current) > 1 {
		var next [][]byte
		for i := 0; i < len(current); i += 2 {
			left := current[i]
			var right []byte
			if i+1 < len(current) {
				right = current[i+1]
			} else {
				right = left // duplicate-last for odd counts
			}
			h := sha256.New()
			h.Write(left)
			h.Write(right)
			next = append(next, h.Sum(nil))
		}
		t.levels = append(t.levels, next)
		current = next
	}

	return t, nil
}

// Root returns the root hash (32 bytes). Safe to call on a freshly built
// tree; caller must not mutate the returned slice.
func (t *Tree) Root() []byte {
	top := t.levels[len(t.levels)-1]
	return append([]byte(nil), top[0]...)
}

// LeafCount returns the number of leaves fed into NewTree.
func (t *Tree) LeafCount() int { return len(t.leaves) }

// Leaves returns a defensive copy of the leaves.
func (t *Tree) Leaves() [][]byte {
	out := make([][]byte, len(t.leaves))
	for i, l := range t.leaves {
		out[i] = append([]byte(nil), l...)
	}
	return out
}

// Depth returns the number of hash levels (including the leaves). A
// single-leaf tree has Depth 1; two leaves produce Depth 2; etc.
func (t *Tree) Depth() int { return len(t.levels) }
