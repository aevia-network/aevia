package pinning

import (
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

// Quota caps what a single Provider Node will accept. Zero means unlimited.
type Quota struct {
	MaxBytes uint64 // total bytes (manifest JSON + all segments) across all pins
	MaxPins  int    // total pinned CIDs
}

// ErrQuotaExceeded is returned by Pin when adding this content would
// violate MaxBytes or MaxPins.
type ErrQuotaExceeded struct {
	Resource string // "bytes" or "pins"
	Limit    uint64
	Current  uint64
	Adding   uint64
}

func (e ErrQuotaExceeded) Error() string {
	return fmt.Sprintf("pinning: quota exceeded on %s — limit=%d current=%d adding=%d",
		e.Resource, e.Limit, e.Current, e.Adding)
}

const (
	keyQuotaCount = "_quota:count"
	keyQuotaBytes = "_quota:bytes"
)

// Usage returns current pin count and total bytes used. Exported so
// operators can surface it via `aevia-node list` or a metrics endpoint.
func (c *ContentStore) Usage() (int, uint64, error) {
	count, err := readUint64(c.store, []byte(keyQuotaCount))
	if err != nil {
		return 0, 0, err
	}
	bytesUsed, err := readUint64(c.store, []byte(keyQuotaBytes))
	if err != nil {
		return 0, 0, err
	}
	return int(count), bytesUsed, nil
}

func readUint64(s *storage.Store, key []byte) (uint64, error) {
	raw, err := s.Get(key)
	if errors.Is(err, storage.ErrNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	if len(raw) != 8 {
		return 0, fmt.Errorf("pinning: counter %s has unexpected len %d", key, len(raw))
	}
	return binary.BigEndian.Uint64(raw), nil
}

func putUint64(b storage.Batch, key []byte, v uint64) error {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, v)
	return b.Put(key, buf)
}
