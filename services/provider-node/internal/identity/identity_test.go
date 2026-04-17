package identity

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/libp2p/go-libp2p/core/peer"
)

func TestLoadOrCreateCreatesFileOnFirstCall(t *testing.T) {
	dir := t.TempDir()

	priv, err := LoadOrCreate(dir)
	if err != nil {
		t.Fatalf("LoadOrCreate: %v", err)
	}
	if priv == nil {
		t.Fatal("LoadOrCreate returned nil key")
	}

	keyPath := filepath.Join(dir, "identity.key")
	info, err := os.Stat(keyPath)
	if err != nil {
		t.Fatalf("stat key file: %v", err)
	}

	if mode := info.Mode().Perm(); mode != 0o600 {
		t.Fatalf("identity key perm = %o, want 0600", mode)
	}
}

func TestLoadOrCreateIsStableAcrossCalls(t *testing.T) {
	dir := t.TempDir()

	first, err := LoadOrCreate(dir)
	if err != nil {
		t.Fatalf("first LoadOrCreate: %v", err)
	}

	second, err := LoadOrCreate(dir)
	if err != nil {
		t.Fatalf("second LoadOrCreate: %v", err)
	}

	firstID, err := peer.IDFromPrivateKey(first)
	if err != nil {
		t.Fatalf("first peer.IDFromPrivateKey: %v", err)
	}
	secondID, err := peer.IDFromPrivateKey(second)
	if err != nil {
		t.Fatalf("second peer.IDFromPrivateKey: %v", err)
	}

	if firstID != secondID {
		t.Fatalf("PeerID not stable across restarts: first=%s second=%s", firstID, secondID)
	}
}

func TestLoadOrCreateRejectsEmptyDir(t *testing.T) {
	if _, err := LoadOrCreate(""); err == nil {
		t.Fatal("LoadOrCreate(\"\") returned nil error, want non-nil")
	}
}
