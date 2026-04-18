// Package pinning holds the Provider Node's pin set — the CIDs this node
// persistently serves. Backed by internal/storage (BadgerDB).
//
// The content model is: one manifest per CID + N segments. A Pin commits
// manifest + every segment atomically via storage.WriteBatch; a half-
// written pin (manifest present, some segments missing) is forbidden by
// construction.
package pinning

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/storage"
)

// Key prefixes. Documented here so an operator reading a live BadgerDB
// with the badger CLI can orient themselves without the source.
const (
	prefixManifest = "manifest:"
	prefixSegment  = "segment:"
)

// ContentStore is the pin-set-backed-by-storage.
type ContentStore struct {
	store *storage.Store
}

// NewContentStore binds a storage.Store into a ContentStore.
func NewContentStore(s *storage.Store) *ContentStore {
	return &ContentStore{store: s}
}

// Pin commits (manifest, segments) atomically. manifest.SegmentCount MUST
// equal len(segments). Fails fast if the shape is inconsistent — a
// corrupted pin is worse than no pin.
func (c *ContentStore) Pin(cid string, m *manifest.Manifest, segments [][]byte) error {
	if cid == "" {
		return errors.New("pinning: cid is required")
	}
	if m == nil {
		return errors.New("pinning: manifest is required")
	}
	if m.CID != cid {
		return fmt.Errorf("pinning: manifest.CID=%q does not match cid=%q", m.CID, cid)
	}
	if m.SegmentCount != len(segments) {
		return fmt.Errorf("pinning: manifest.SegmentCount=%d != len(segments)=%d", m.SegmentCount, len(segments))
	}
	manifestJSON, err := m.CanonicalJSON()
	if err != nil {
		return fmt.Errorf("pinning: canonical json: %w", err)
	}

	return c.store.WriteBatch(func(b storage.Batch) error {
		if err := b.Put(manifestKey(cid), manifestJSON); err != nil {
			return err
		}
		for i, seg := range segments {
			if err := b.Put(segmentKey(cid, i), seg); err != nil {
				return err
			}
		}
		return nil
	})
}

// GetManifest returns the stored manifest for cid or storage.ErrNotFound.
func (c *ContentStore) GetManifest(cid string) (*manifest.Manifest, error) {
	raw, err := c.store.Get(manifestKey(cid))
	if err != nil {
		return nil, err
	}
	m, err := manifest.ParseManifest(raw)
	if err != nil {
		return nil, fmt.Errorf("pinning: parse manifest: %w", err)
	}
	return m, nil
}

// GetSegment returns the stored bytes for (cid, index) or storage.ErrNotFound.
func (c *ContentStore) GetSegment(cid string, index int) ([]byte, error) {
	if index < 0 {
		return nil, fmt.Errorf("pinning: segment index must be >= 0 (got %d)", index)
	}
	return c.store.Get(segmentKey(cid, index))
}

// Has returns true iff the manifest for cid exists. Callers that need to
// confirm segment completeness should iterate GetSegment.
func (c *ContentStore) Has(cid string) (bool, error) {
	return c.store.Has(manifestKey(cid))
}

// List returns every pinned CID (order not guaranteed).
func (c *ContentStore) List() ([]string, error) {
	keys, err := c.store.ListKeysWithPrefix([]byte(prefixManifest))
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(keys))
	for _, k := range keys {
		out = append(out, string(k[len(prefixManifest):]))
	}
	return out, nil
}

// Unpin removes the manifest and all segments for cid atomically. Idempotent.
func (c *ContentStore) Unpin(cid string) error {
	m, err := c.GetManifest(cid)
	if errors.Is(err, storage.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return c.store.WriteBatch(func(b storage.Batch) error {
		if err := b.Delete(manifestKey(cid)); err != nil {
			return err
		}
		for i := 0; i < m.SegmentCount; i++ {
			if err := b.Delete(segmentKey(cid, i)); err != nil {
				return err
			}
		}
		return nil
	})
}

func manifestKey(cid string) []byte { return []byte(prefixManifest + cid) }

func segmentKey(cid string, index int) []byte {
	return []byte(prefixSegment + cid + ":" + strconv.Itoa(index))
}
