package dht_test

import (
	"context"
	"testing"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"

	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
)

func newHost(t *testing.T) host.Host {
	t.Helper()
	h, err := libp2p.New(
		libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"),
		libp2p.DisableRelay(),
	)
	if err != nil {
		t.Fatalf("libp2p.New: %v", err)
	}
	t.Cleanup(func() { _ = h.Close() })
	return h
}

func TestNewRequiresHost(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if _, err := aeviadht.New(ctx, nil, aeviadht.ModeServer); err == nil {
		t.Fatal("New(nil) returned nil error")
	}
}

func TestDHTBoots(t *testing.T) {
	h := newHost(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	d, err := aeviadht.New(ctx, h, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })

	if d.Host() != h {
		t.Fatal("Host() did not return the host passed to New")
	}
	if d.Inner() == nil {
		t.Fatal("Inner() is nil")
	}
	if d.Mode() != aeviadht.ModeServer {
		t.Fatalf("Mode = %v, want ModeServer", d.Mode())
	}
}

func TestDHTBootstrapEmptySucceeds(t *testing.T) {
	h := newHost(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	d, err := aeviadht.New(ctx, h, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })

	// No seeds — Bootstrap still triggers internal refresh and returns nil.
	if err := d.Bootstrap(ctx, nil); err != nil {
		t.Fatalf("Bootstrap(nil): %v", err)
	}
}

func TestDHTBootstrapConnectsToSeed(t *testing.T) {
	seedHost := newHost(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	seedDHT, err := aeviadht.New(ctx, seedHost, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("seed New: %v", err)
	}
	t.Cleanup(func() { _ = seedDHT.Close() })

	clientHost := newHost(t)
	clientDHT, err := aeviadht.New(ctx, clientHost, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("client New: %v", err)
	}
	t.Cleanup(func() { _ = clientDHT.Close() })

	seedInfo := peer.AddrInfo{ID: seedHost.ID(), Addrs: seedHost.Addrs()}
	if err := clientDHT.Bootstrap(ctx, []peer.AddrInfo{seedInfo}); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}

	// Connection established — client should have seed in its peerstore.
	if clientHost.Network().Connectedness(seedHost.ID()).String() != "Connected" {
		t.Fatalf("client not Connected to seed after Bootstrap")
	}
}

func TestDHTBootstrapFailsWhenAllSeedsUnreachable(t *testing.T) {
	h := newHost(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	d, err := aeviadht.New(ctx, h, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })

	// Generate a PeerID that is syntactically valid but not actually running.
	dead := newHost(t)
	_ = dead.Close()

	info := peer.AddrInfo{ID: dead.ID(), Addrs: dead.Addrs()}
	if err := d.Bootstrap(ctx, []peer.AddrInfo{info}); err == nil {
		t.Fatal("Bootstrap succeeded with only unreachable seeds; want error")
	}
}
