package manifest

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
)

// ManifestVersion is the wire format version for Aevia content manifests.
const ManifestVersion = 1

// Manifest is the cryptographic anchor of a piece of Aevia content.
//
// It's the JSON document ContentRegistry on Base points to (via cid field),
// and the document a viewer fetches to decide whether bytes received from
// ANY transport (libp2p stream, HTTPS, relay bridge, CDN fallback) are
// authentic.
type Manifest struct {
	Version         int      `json:"version"`
	CID             string   `json:"cid"`
	Root            string   `json:"root"`
	SegmentCount    int      `json:"segment_count"`
	SegmentDuration int      `json:"segment_duration"`
	Leaves          []string `json:"leaves"`
}

// BuildFromPayloads hashes each payload, builds the Merkle tree, and wraps
// root + CID in a Manifest. segmentDuration is in seconds.
func BuildFromPayloads(payloads [][]byte, segmentDuration int) (*Manifest, error) {
	if len(payloads) == 0 {
		return nil, errors.New("manifest: need at least 1 segment")
	}
	if segmentDuration <= 0 {
		return nil, errors.New("manifest: segmentDuration must be > 0")
	}

	leaves := make([][]byte, len(payloads))
	leavesHex := make([]string, len(payloads))
	for i, p := range payloads {
		leaves[i] = HashLeaf(p)
		leavesHex[i] = hex.EncodeToString(leaves[i])
	}

	tree, err := NewTree(leaves)
	if err != nil {
		return nil, err
	}
	root := tree.Root()
	cid, err := CIDv1Raw(root)
	if err != nil {
		return nil, err
	}

	return &Manifest{
		Version:         ManifestVersion,
		CID:             cid,
		Root:            hex.EncodeToString(root),
		SegmentCount:    len(payloads),
		SegmentDuration: segmentDuration,
		Leaves:          leavesHex,
	}, nil
}

// CanonicalJSON returns the manifest serialized deterministically. The json
// tag order on Manifest fixes the key order; encoding/json.Marshal emits no
// whitespace. Two implementations producing identical Manifest values will
// produce identical bytes here.
func (m *Manifest) CanonicalJSON() ([]byte, error) {
	return json.Marshal(m)
}

// ParseManifest decodes and structurally validates a manifest received from
// the wire. Callers should also run Verify to confirm the cryptographic
// invariants.
func ParseManifest(raw []byte) (*Manifest, error) {
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("manifest: decode json: %w", err)
	}
	return &m, nil
}

// Verify recomputes the Merkle root from the stored leaves, rebuilds the
// CID, and asserts all three agree with the stored values. This is the
// consistency check a viewer runs BEFORE comparing the CID against the
// on-chain anchor in ContentRegistry.
func (m *Manifest) Verify() error {
	if m.Version != ManifestVersion {
		return fmt.Errorf("manifest: unsupported version %d", m.Version)
	}
	if m.SegmentCount != len(m.Leaves) {
		return fmt.Errorf("manifest: segment_count %d != len(leaves) %d", m.SegmentCount, len(m.Leaves))
	}
	if m.SegmentDuration <= 0 {
		return fmt.Errorf("manifest: segment_duration must be > 0 (got %d)", m.SegmentDuration)
	}

	leaves := make([][]byte, len(m.Leaves))
	for i, h := range m.Leaves {
		b, err := hex.DecodeString(h)
		if err != nil {
			return fmt.Errorf("manifest: leaf %d bad hex: %w", i, err)
		}
		if len(b) != HashSize {
			return fmt.Errorf("manifest: leaf %d len %d, want %d", i, len(b), HashSize)
		}
		leaves[i] = b
	}
	tree, err := NewTree(leaves)
	if err != nil {
		return err
	}

	rootBytes, err := hex.DecodeString(m.Root)
	if err != nil {
		return fmt.Errorf("manifest: root bad hex: %w", err)
	}
	if !bytes.Equal(tree.Root(), rootBytes) {
		return errors.New("manifest: recomputed merkle root does not match stored root")
	}

	cid, err := CIDv1Raw(tree.Root())
	if err != nil {
		return err
	}
	if cid != m.CID {
		return fmt.Errorf("manifest: cid mismatch — stored %s, recomputed %s", m.CID, cid)
	}

	return nil
}

// LeafAt returns the raw hash bytes for a given segment index.
func (m *Manifest) LeafAt(index int) ([]byte, error) {
	if index < 0 || index >= len(m.Leaves) {
		return nil, fmt.Errorf("manifest: leaf index %d out of range [0,%d)", index, len(m.Leaves))
	}
	b, err := hex.DecodeString(m.Leaves[index])
	if err != nil {
		return nil, fmt.Errorf("manifest: leaf %d bad hex: %w", index, err)
	}
	if len(b) != HashSize {
		return nil, fmt.Errorf("manifest: leaf %d len %d, want %d", index, len(b), HashSize)
	}
	return b, nil
}
