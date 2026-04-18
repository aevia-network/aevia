package storage_test

import (
	"bytes"
	"errors"
	"path/filepath"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/storage"
)

func openOnDisk(t *testing.T) (*storage.Store, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "badger")
	s, err := storage.Open(storage.Options{Path: path, Silent: true})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return s, path
}

func TestOpenInMemoryAndRoundTrip(t *testing.T) {
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("Open in-memory: %v", err)
	}
	defer s.Close()

	if err := s.Put([]byte("hello"), []byte("aevia")); err != nil {
		t.Fatalf("Put: %v", err)
	}
	got, err := s.Get([]byte("hello"))
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if !bytes.Equal(got, []byte("aevia")) {
		t.Fatalf("Get = %q, want %q", got, "aevia")
	}
}

func TestGetMissingReturnsErrNotFound(t *testing.T) {
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer s.Close()

	_, err = s.Get([]byte("nope"))
	if !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("Get on missing key: err = %v, want ErrNotFound", err)
	}
}

func TestHasReflectsPresence(t *testing.T) {
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer s.Close()

	present, err := s.Has([]byte("k"))
	if err != nil {
		t.Fatalf("Has: %v", err)
	}
	if present {
		t.Fatal("Has on empty store returned true")
	}

	_ = s.Put([]byte("k"), []byte("v"))

	present, err = s.Has([]byte("k"))
	if err != nil {
		t.Fatalf("Has after put: %v", err)
	}
	if !present {
		t.Fatal("Has after Put returned false")
	}
}

func TestDeleteIsIdempotent(t *testing.T) {
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer s.Close()

	if err := s.Delete([]byte("ghost")); err != nil {
		t.Fatalf("Delete on missing: %v", err)
	}

	_ = s.Put([]byte("k"), []byte("v"))
	if err := s.Delete([]byte("k")); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := s.Get([]byte("k")); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("Get after Delete: err = %v, want ErrNotFound", err)
	}
}

func TestListKeysWithPrefix(t *testing.T) {
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer s.Close()

	for _, k := range []string{"manifest:a", "manifest:b", "manifest:c", "segment:a:0", "segment:b:0"} {
		if err := s.Put([]byte(k), []byte("v")); err != nil {
			t.Fatalf("Put %q: %v", k, err)
		}
	}

	manifests, err := s.ListKeysWithPrefix([]byte("manifest:"))
	if err != nil {
		t.Fatalf("ListKeysWithPrefix: %v", err)
	}
	if len(manifests) != 3 {
		t.Fatalf("got %d manifest keys, want 3: %q", len(manifests), manifests)
	}
}

func TestWriteBatchIsAtomic(t *testing.T) {
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer s.Close()

	err = s.WriteBatch(func(b storage.Batch) error {
		_ = b.Put([]byte("x"), []byte("1"))
		_ = b.Put([]byte("y"), []byte("2"))
		return nil
	})
	if err != nil {
		t.Fatalf("WriteBatch: %v", err)
	}
	for _, k := range []string{"x", "y"} {
		if _, err := s.Get([]byte(k)); err != nil {
			t.Fatalf("Get %q after batch: %v", k, err)
		}
	}
}

func TestWriteBatchRollsBackOnError(t *testing.T) {
	s, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer s.Close()

	sentinel := errors.New("abort")
	err = s.WriteBatch(func(b storage.Batch) error {
		_ = b.Put([]byte("persisted"), []byte("yes"))
		return sentinel
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v, want sentinel", err)
	}
	if _, err := s.Get([]byte("persisted")); !errors.Is(err, storage.ErrNotFound) {
		t.Fatal("value leaked out of failed batch")
	}
}

// TestCloseReopenPreservesData is the seed of TestContentSurvivesNodeRestart
// in M5-i7 — persistence is the whole point of this package.
func TestCloseReopenPreservesData(t *testing.T) {
	s, path := openOnDisk(t)
	if err := s.Put([]byte("durable"), []byte("yes")); err != nil {
		t.Fatalf("Put: %v", err)
	}
	if err := s.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	reopened, err := storage.Open(storage.Options{Path: path, Silent: true})
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer reopened.Close()

	got, err := reopened.Get([]byte("durable"))
	if err != nil {
		t.Fatalf("Get after reopen: %v", err)
	}
	if !bytes.Equal(got, []byte("yes")) {
		t.Fatalf("reopened value = %q, want yes", got)
	}
}
