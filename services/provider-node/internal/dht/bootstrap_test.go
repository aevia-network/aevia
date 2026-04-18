package dht_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/peer"

	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
)

func TestParseBootstrapPeersEmpty(t *testing.T) {
	infos, err := aeviadht.ParseBootstrapPeers("")
	if err != nil {
		t.Fatalf("Parse(\"\"): %v", err)
	}
	if len(infos) != 0 {
		t.Fatalf("expected 0 peers, got %d", len(infos))
	}

	infos, err = aeviadht.ParseBootstrapPeers("   ")
	if err != nil {
		t.Fatalf("Parse(whitespace): %v", err)
	}
	if len(infos) != 0 {
		t.Fatalf("expected 0 peers for whitespace input, got %d", len(infos))
	}
}

func TestParseBootstrapPeersRejectsBadMultiaddr(t *testing.T) {
	if _, err := aeviadht.ParseBootstrapPeers("not-a-multiaddr"); err == nil {
		t.Fatal("ParseBootstrapPeers accepted bad input")
	}
}

func TestParseBootstrapPeersRoundTrip(t *testing.T) {
	// Build a real multiaddr from a live host so the /p2p/... suffix is
	// parseable.
	h, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"), libp2p.DisableRelay())
	if err != nil {
		t.Fatalf("libp2p.New: %v", err)
	}
	t.Cleanup(func() { _ = h.Close() })

	addr := fmt.Sprintf("%s/p2p/%s", h.Addrs()[0], h.ID())
	infos, err := aeviadht.ParseBootstrapPeers(addr)
	if err != nil {
		t.Fatalf("ParseBootstrapPeers: %v", err)
	}
	if len(infos) != 1 {
		t.Fatalf("len(infos) = %d, want 1", len(infos))
	}
	if infos[0].ID != h.ID() {
		t.Fatalf("peer id mismatch: got=%s want=%s", infos[0].ID, h.ID())
	}
}

// TestThreeNodeRingDiscovery exercises Kademlia transitivity — the key
// property that makes the network scale: C can discover content provided
// by A through middleman B, even though C never directly bootstraps from A.
//
// Topology:
//
//	A <--bootstrap-- B <--bootstrap-- C
//
// A provides CID X. C queries for X. Expected: C receives A's PeerID.
func TestThreeNodeRingDiscovery(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	hostA := newHost(t)
	hostB := newHost(t)
	hostC := newHost(t)

	dhtA, err := aeviadht.New(ctx, hostA, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("dhtA: %v", err)
	}
	t.Cleanup(func() { _ = dhtA.Close() })
	dhtB, err := aeviadht.New(ctx, hostB, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("dhtB: %v", err)
	}
	t.Cleanup(func() { _ = dhtB.Close() })
	dhtC, err := aeviadht.New(ctx, hostC, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("dhtC: %v", err)
	}
	t.Cleanup(func() { _ = dhtC.Close() })

	// B bootstraps from A; C bootstraps from B. A does not directly know C.
	if err := dhtB.Bootstrap(ctx, []peer.AddrInfo{{ID: hostA.ID(), Addrs: hostA.Addrs()}}); err != nil {
		t.Fatalf("B bootstrap from A: %v", err)
	}
	if err := dhtC.Bootstrap(ctx, []peer.AddrInfo{{ID: hostB.ID(), Addrs: hostB.Addrs()}}); err != nil {
		t.Fatalf("C bootstrap from B: %v", err)
	}
	// Let routing tables settle and fill (Kad refreshes via queries).
	time.Sleep(500 * time.Millisecond)

	cid := testCID(t, "three-node-ring")
	if err := dhtA.Provide(ctx, cid); err != nil {
		t.Fatalf("A.Provide: %v", err)
	}

	findCtx, findCancel := context.WithTimeout(ctx, 10*time.Second)
	defer findCancel()

	providers, err := dhtC.FindProviders(findCtx, cid, 5)
	if err != nil {
		t.Fatalf("C.FindProviders: %v", err)
	}

	found := false
	for _, pid := range providers {
		if pid == hostA.ID() {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("C did not find A (through B) — providers=%v, want %s", providers, hostA.ID())
	}
}
