// Package storage wraps BadgerDB with a tight key-value surface tailored to
// the Aevia Provider Node's needs. Upstream badger exposes a rich
// transactional API; we only need atomic Put + Get + Has + Delete + List-by-
// prefix, so the wrapper keeps call sites clean and makes the storage
// layer swappable (e.g. for an in-memory test implementation) later.
package storage

import (
	"errors"
	"fmt"

	badger "github.com/dgraph-io/badger/v4"
)

// Store is the Aevia-facing abstraction over BadgerDB. Safe for concurrent
// use; Badger's underlying transactions are goroutine-safe.
type Store struct {
	db *badger.DB
}

// Options tune Store construction. Keep this small — every knob is a
// future migration risk.
type Options struct {
	// Path is the filesystem path for the BadgerDB directory. If empty,
	// the store is opened in-memory (useful for tests).
	Path string
	// Logger silences Badger's noisy default INFO logs. Pass nil to keep
	// the default logger, or badger.DefaultOptions("").Logger for silence.
	Silent bool
}

// Open builds a Store backed by BadgerDB at the given path. If opts.Path
// is empty, the store is in-memory.
func Open(opts Options) (*Store, error) {
	var bOpts badger.Options
	if opts.Path == "" {
		bOpts = badger.DefaultOptions("").WithInMemory(true)
	} else {
		bOpts = badger.DefaultOptions(opts.Path)
	}
	if opts.Silent {
		bOpts = bOpts.WithLogger(nil)
	}
	// Single-stream compaction and limited memtable sizes keep the memory
	// footprint small for a Provider Node, which is the typical deployment
	// (VPS with 2-8 GB RAM, not a 128 GB database server).
	bOpts = bOpts.WithNumCompactors(2).WithNumMemtables(2).WithNumLevelZeroTables(2)

	db, err := badger.Open(bOpts)
	if err != nil {
		return nil, fmt.Errorf("storage: open badger at %q: %w", opts.Path, err)
	}
	return &Store{db: db}, nil
}

// Close releases Badger's file handles and in-memory structures.
func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

// Put writes key=val atomically.
func (s *Store) Put(key, val []byte) error {
	return s.db.Update(func(txn *badger.Txn) error {
		return txn.Set(append([]byte(nil), key...), append([]byte(nil), val...))
	})
}

// Get returns the value for key. Returns (nil, ErrNotFound) when the key is
// absent — callers should check errors.Is(err, storage.ErrNotFound) to
// distinguish a missing key from a transport error.
func (s *Store) Get(key []byte) ([]byte, error) {
	var out []byte
	err := s.db.View(func(txn *badger.Txn) error {
		item, err := txn.Get(key)
		if err != nil {
			if errors.Is(err, badger.ErrKeyNotFound) {
				return ErrNotFound
			}
			return err
		}
		return item.Value(func(v []byte) error {
			out = append([]byte(nil), v...)
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// Has returns true iff the key exists in the store.
func (s *Store) Has(key []byte) (bool, error) {
	found := false
	err := s.db.View(func(txn *badger.Txn) error {
		_, err := txn.Get(key)
		if err == nil {
			found = true
			return nil
		}
		if errors.Is(err, badger.ErrKeyNotFound) {
			return nil
		}
		return err
	})
	return found, err
}

// Delete removes the key. Idempotent: deleting a missing key returns nil.
func (s *Store) Delete(key []byte) error {
	return s.db.Update(func(txn *badger.Txn) error {
		return txn.Delete(key)
	})
}

// ListKeysWithPrefix returns every key that starts with prefix. Keys are
// defensively copied out of Badger's managed buffer so the caller can use
// them after the transaction closes.
func (s *Store) ListKeysWithPrefix(prefix []byte) ([][]byte, error) {
	var keys [][]byte
	err := s.db.View(func(txn *badger.Txn) error {
		it := txn.NewIterator(badger.DefaultIteratorOptions)
		defer it.Close()
		for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
			k := it.Item().KeyCopy(nil)
			keys = append(keys, k)
		}
		return nil
	})
	return keys, err
}

// WriteBatch executes fn as an atomic multi-key write. Either every Put
// inside fn lands or none of them do.
func (s *Store) WriteBatch(fn func(Batch) error) error {
	return s.db.Update(func(txn *badger.Txn) error {
		return fn(batchTxn{txn: txn})
	})
}

// Batch is the subset of Store methods usable inside a WriteBatch closure.
type Batch interface {
	Put(key, val []byte) error
	Delete(key []byte) error
}

type batchTxn struct {
	txn *badger.Txn
}

func (b batchTxn) Put(key, val []byte) error {
	return b.txn.Set(append([]byte(nil), key...), append([]byte(nil), val...))
}

func (b batchTxn) Delete(key []byte) error {
	return b.txn.Delete(append([]byte(nil), key...))
}

// ErrNotFound is returned by Get when the key does not exist.
var ErrNotFound = errors.New("storage: key not found")
