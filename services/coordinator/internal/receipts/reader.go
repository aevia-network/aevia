// Package receipts gives the coordinator a read-only view into the
// Proof-of-Relay receipt store that provider-nodes write to.
//
// For M7 the shared-storage model is intentionally simple: the
// coordinator opens the same BadgerDB path the provider-node uses. In a
// real multi-machine deployment (M8+) we will replace this with an HTTP
// endpoint on the provider-node (POST /ack already exists on the write
// side; a GET /receipts?since=X&until=Y mirror is trivial) or with an
// event stream. The interface below is the seam that lets us swap
// implementations without touching the settlement pipeline.
package receipts

import (
	"fmt"

	"github.com/Leeaandrob/aevia/services/provider-node/por"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

// Reader is the settlement pipeline's upstream dependency. The production
// implementation is *Reader (BadgerDB-backed); tests can plug any value
// that satisfies it.
type WindowReader interface {
	WindowForAllProviders(since, until int64) ([]*por.Receipt, error)
	Close() error
}

// Reader opens the shared receipt store on disk.
type Reader struct {
	store *storage.Store
	rs    *por.ReceiptStore
}

// Open mounts a BadgerDB at path. The caller MUST Close() when done.
//
// path must be the same path the producer (provider-node) uses. For
// production deployments where both processes run on the same host this
// is the natural setup; for distributed deployments M8 replaces this
// with an HTTP-backed WindowReader.
func Open(path string) (*Reader, error) {
	if path == "" {
		return nil, fmt.Errorf("receipts: path is empty")
	}
	s, err := storage.Open(storage.Options{Path: path, Silent: true})
	if err != nil {
		return nil, fmt.Errorf("receipts: open storage at %q: %w", path, err)
	}
	return &Reader{store: s, rs: por.NewReceiptStore(s)}, nil
}

// OpenInMemory is the test-friendly alternative — no disk state, receipt
// store sits in RAM. Used by unit tests + simulated-backend integration.
func OpenInMemory() (*Reader, error) {
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		return nil, fmt.Errorf("receipts: in-memory store: %w", err)
	}
	return &Reader{store: s, rs: por.NewReceiptStore(s)}, nil
}

// UnderlyingReceiptStore exposes the por.ReceiptStore so tests can
// populate it directly. Production code paths should NOT use this.
func (r *Reader) UnderlyingReceiptStore() *por.ReceiptStore { return r.rs }

// WindowForAllProviders returns every receipt whose timestamp falls in
// [since, until). Passing 0 on either bound disables that side. Result
// order is unspecified — the Settlement aggregator sorts internally.
func (r *Reader) WindowForAllProviders(since, until int64) ([]*por.Receipt, error) {
	all, err := r.rs.List()
	if err != nil {
		return nil, err
	}
	if since == 0 && until == 0 {
		return all, nil
	}
	out := make([]*por.Receipt, 0, len(all))
	for _, receipt := range all {
		if since > 0 && receipt.TimestampUnix < since {
			continue
		}
		if until > 0 && receipt.TimestampUnix >= until {
			continue
		}
		out = append(out, receipt)
	}
	return out, nil
}

// Close releases the underlying BadgerDB handle.
func (r *Reader) Close() error {
	if r == nil || r.store == nil {
		return nil
	}
	return r.store.Close()
}
