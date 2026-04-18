package por

import (
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/storage"
)

// Key scheme: receipt:<provider_pid>:<ts_big_endian>:<nonce_big_endian>
// Fixed-width binary encoding of timestamp+nonce keeps prefix scans in
// time order without parsing string representations.
const (
	prefixReceipt    = "receipt:"
	keyTimestampSize = 8
	keyNonceSize     = 8
)

// ReceiptStore persists Receipts in BadgerDB, indexed primarily by provider
// so settlements can gather everything earned by a single node in one scan.
type ReceiptStore struct {
	store *storage.Store
}

// NewReceiptStore binds a storage.Store into a ReceiptStore. The store is
// shared with pinning.ContentStore — they use disjoint key prefixes so
// coexistence is safe.
func NewReceiptStore(s *storage.Store) *ReceiptStore {
	return &ReceiptStore{store: s}
}

// Put serializes and persists a dual-signed receipt. Callers should have
// verified both signatures BEFORE calling Put; this method is a
// storage-level operation that trusts the input shape.
func (s *ReceiptStore) Put(r *Receipt) error {
	if r == nil {
		return errors.New("por: nil receipt")
	}
	if r.ProviderPeerID == "" {
		return errors.New("por: receipt missing ProviderPeerID")
	}
	raw, err := json.Marshal(r)
	if err != nil {
		return fmt.Errorf("por: marshal receipt: %w", err)
	}
	return s.store.Put(receiptKey(r), raw)
}

// GetByProvider returns every receipt for the named provider whose
// timestamp is in [since, until). Passing since=0 / until=0 skips that
// side of the bound. Returns receipts in ascending time order.
func (s *ReceiptStore) GetByProvider(providerPeerID string, since, until int64) ([]*Receipt, error) {
	prefix := []byte(prefixReceipt + providerPeerID + ":")
	keys, err := s.store.ListKeysWithPrefix(prefix)
	if err != nil {
		return nil, err
	}
	var out []*Receipt
	for _, k := range keys {
		ts, _, err := parseTsNonce(k, prefix)
		if err != nil {
			continue // skip malformed keys — do not fail the whole read
		}
		if since > 0 && ts < since {
			continue
		}
		if until > 0 && ts >= until {
			continue
		}
		raw, err := s.store.Get(k)
		if err != nil {
			return nil, err
		}
		var r Receipt
		if err := json.Unmarshal(raw, &r); err != nil {
			return nil, fmt.Errorf("por: unmarshal receipt %x: %w", k, err)
		}
		out = append(out, &r)
	}
	return out, nil
}

// List returns every stored receipt (across all providers). Intended for
// auditing and the /aevia-node receipts command; never call during a hot
// request path.
func (s *ReceiptStore) List() ([]*Receipt, error) {
	keys, err := s.store.ListKeysWithPrefix([]byte(prefixReceipt))
	if err != nil {
		return nil, err
	}
	out := make([]*Receipt, 0, len(keys))
	for _, k := range keys {
		raw, err := s.store.Get(k)
		if err != nil {
			return nil, err
		}
		var r Receipt
		if err := json.Unmarshal(raw, &r); err != nil {
			return nil, fmt.Errorf("por: unmarshal %s: %w", hex.EncodeToString(k), err)
		}
		out = append(out, &r)
	}
	return out, nil
}

// Delete removes a receipt by its natural key.
func (s *ReceiptStore) Delete(r *Receipt) error {
	return s.store.Delete(receiptKey(r))
}

func receiptKey(r *Receipt) []byte {
	suffix := make([]byte, keyTimestampSize+1+keyNonceSize)
	binary.BigEndian.PutUint64(suffix[:keyTimestampSize], uint64(r.TimestampUnix))
	suffix[keyTimestampSize] = ':'
	binary.BigEndian.PutUint64(suffix[keyTimestampSize+1:], r.Nonce)

	key := make([]byte, 0, len(prefixReceipt)+len(r.ProviderPeerID)+1+len(suffix))
	key = append(key, []byte(prefixReceipt)...)
	key = append(key, []byte(r.ProviderPeerID)...)
	key = append(key, ':')
	key = append(key, suffix...)
	return key
}

// parseTsNonce extracts the timestamp + nonce from a receipt key.
func parseTsNonce(key, prefix []byte) (ts int64, nonce uint64, err error) {
	suffix := key[len(prefix):]
	if len(suffix) != keyTimestampSize+1+keyNonceSize || suffix[keyTimestampSize] != ':' {
		return 0, 0, fmt.Errorf("por: malformed receipt key suffix %x", suffix)
	}
	ts = int64(binary.BigEndian.Uint64(suffix[:keyTimestampSize]))
	nonce = binary.BigEndian.Uint64(suffix[keyTimestampSize+1:])
	return ts, nonce, nil
}
