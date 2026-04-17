package node

import (
	"context"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/identity"
)

func TestNewHostHasStablePeerIDAcrossRestarts(t *testing.T) {
	dir := t.TempDir()
	ctx := context.Background()

	priv1, err := identity.LoadOrCreate(dir)
	if err != nil {
		t.Fatalf("LoadOrCreate #1: %v", err)
	}

	n1, err := New(Config{
		PrivKey:      priv1,
		ListenAddrs:  []string{"/ip4/127.0.0.1/tcp/0"},
		DisableRelay: true,
	})
	if err != nil {
		t.Fatalf("New #1: %v", err)
	}
	first := n1.PeerID()
	if err := n1.Close(ctx); err != nil {
		t.Fatalf("Close #1: %v", err)
	}

	priv2, err := identity.LoadOrCreate(dir)
	if err != nil {
		t.Fatalf("LoadOrCreate #2: %v", err)
	}
	n2, err := New(Config{
		PrivKey:      priv2,
		ListenAddrs:  []string{"/ip4/127.0.0.1/tcp/0"},
		DisableRelay: true,
	})
	if err != nil {
		t.Fatalf("New #2: %v", err)
	}
	second := n2.PeerID()
	if err := n2.Close(ctx); err != nil {
		t.Fatalf("Close #2: %v", err)
	}

	if first != second {
		t.Fatalf("PeerID not stable: first=%s second=%s", first, second)
	}
}

func TestNewRejectsNilPrivKey(t *testing.T) {
	if _, err := New(Config{}); err == nil {
		t.Fatal("New with nil PrivKey returned nil error")
	}
}
