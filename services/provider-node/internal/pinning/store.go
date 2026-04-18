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
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
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
	quota Quota
}

// NewContentStore binds a storage.Store into a ContentStore.
func NewContentStore(s *storage.Store) *ContentStore {
	return &ContentStore{store: s}
}

// WithQuota attaches or replaces the Quota. Existing pins are grandfathered:
// the quota only gates future Pin calls. Returns the receiver for chaining.
func (c *ContentStore) WithQuota(q Quota) *ContentStore {
	c.quota = q
	return c
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

	// Quota check + counter update happen inside the same WriteBatch so a
	// partial Pin never leaves counters drifted from reality.
	pinSize := uint64(len(manifestJSON))
	for _, seg := range segments {
		pinSize += uint64(len(seg))
	}

	currentCount, currentBytes, err := c.Usage()
	if err != nil {
		return err
	}
	if c.quota.MaxPins > 0 && currentCount+1 > c.quota.MaxPins {
		return ErrQuotaExceeded{Resource: "pins", Limit: uint64(c.quota.MaxPins), Current: uint64(currentCount), Adding: 1}
	}
	if c.quota.MaxBytes > 0 && currentBytes+pinSize > c.quota.MaxBytes {
		return ErrQuotaExceeded{Resource: "bytes", Limit: c.quota.MaxBytes, Current: currentBytes, Adding: pinSize}
	}

	// Guard against double-pinning the same CID — if already pinned,
	// subtract its size from the delta so counters reflect reality.
	existing, err := c.GetManifest(cid)
	var existingSize uint64
	if err == nil {
		existingJSON, _ := existing.CanonicalJSON()
		existingSize = uint64(len(existingJSON))
		for i := 0; i < existing.SegmentCount; i++ {
			seg, segErr := c.GetSegment(cid, i)
			if segErr == nil {
				existingSize += uint64(len(seg))
			}
		}
	} else if !errors.Is(err, storage.ErrNotFound) {
		return err
	}

	newCount := currentCount
	newBytes := currentBytes
	if existing == nil {
		newCount++
		newBytes += pinSize
	} else {
		newBytes = currentBytes - existingSize + pinSize
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
		if err := putUint64(b, []byte(keyQuotaCount), uint64(newCount)); err != nil {
			return err
		}
		return putUint64(b, []byte(keyQuotaBytes), newBytes)
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

// PinPayloads is the operator-facing API: given raw segment payloads plus a
// target segment duration, it computes the canonical manifest, then writes
// manifest + every segment to storage atomically. The returned manifest's
// CID is the on-chain anchor that the operator registers in
// ContentRegistry to advertise this pin.
//
// This is the one-call flow for `aevia-node pin <file>` (M5-i8) and any
// future HTTP ingest endpoint.
func (c *ContentStore) PinPayloads(payloads [][]byte, segmentDuration int) (*manifest.Manifest, error) {
	if len(payloads) == 0 {
		return nil, errors.New("pinning: cannot pin empty payload set")
	}
	m, err := manifest.BuildFromPayloads(payloads, segmentDuration)
	if err != nil {
		return nil, err
	}
	if err := c.Pin(m.CID, m, payloads); err != nil {
		return nil, err
	}
	return m, nil
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

	// Compute the byte footprint being released so counters stay accurate.
	manifestJSON, _ := m.CanonicalJSON()
	released := uint64(len(manifestJSON))
	for i := 0; i < m.SegmentCount; i++ {
		seg, err := c.GetSegment(cid, i)
		if err == nil {
			released += uint64(len(seg))
		}
	}

	currentCount, currentBytes, err := c.Usage()
	if err != nil {
		return err
	}
	newCount := currentCount - 1
	if newCount < 0 {
		newCount = 0
	}
	newBytes := uint64(0)
	if currentBytes > released {
		newBytes = currentBytes - released
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
		if err := putUint64(b, []byte(keyQuotaCount), uint64(newCount)); err != nil {
			return err
		}
		return putUint64(b, []byte(keyQuotaBytes), newBytes)
	})
}

func manifestKey(cid string) []byte { return []byte(prefixManifest + cid) }

func segmentKey(cid string, index int) []byte {
	return []byte(prefixSegment + cid + ":" + strconv.Itoa(index))
}
