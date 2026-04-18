package integration_test

import (
	"context"
	"testing"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/peerstore"
	circuitclient "github.com/libp2p/go-libp2p/p2p/protocol/circuitv2/client"
	"github.com/multiformats/go-multiaddr"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// startDirectProviderHost simulates a Provider Node on a public VPS —
// listens on loopback (stands for "public IP" in this lab test),
// serves content via content.Register, needs no relay.
func startDirectProviderHost(t *testing.T) *providerNode {
	t.Helper()
	h, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"))
	if err != nil {
		t.Fatalf("direct provider: %v", err)
	}
	srv := httpx.NewServer(h)
	content.Register(srv)

	ctx, cancel := context.WithCancel(context.Background())
	go func() { _ = srv.ServeLibp2p(ctx) }()
	return &providerNode{host: h, stop: cancel, srv: srv}
}

// staticResolver returns a fixed []peer.ID list — used here to feed the
// client its "known" provider set without the indirection of a DHT.
// The full DHT resolver is already exercised by TestKillSwitchViaDHT in
// dht_killswitch_test.go; this test focuses on the transport-layer
// failover (direct <-> relay).
type staticResolver struct {
	providers []peer.ID
}

func (s *staticResolver) FindProviders(_ context.Context, _ string, _ int) ([]peer.ID, error) {
	return s.providers, nil
}

// TestKillSwitchAcrossAllLayers is the full-stack Kill Test at lab scale.
//
// Topology:
//   - Two Relay Nodes (R1, R2), Circuit Relay v2 HOPs on, forced public.
//   - One Public Provider (direct-dialable, serves content).
//   - One NAT Provider (loopback only, circuit reservations on R1 AND R2).
//   - One Viewer with a staticResolver that returns [public, nat] —
//     the client walks them in order and failovers if one fails.
//
// Scenarios exercised:
//  1. Baseline — all nodes up. Viewer fetches from the first available
//     provider (the public one) and verifies.
//  2. Kill the Public Provider. Viewer retries and succeeds via the NAT
//     Provider through one of the two relays.
//  3. Also kill R1. Viewer retries and succeeds via the NAT Provider
//     through R2.
//
// This is the empirical demonstration for the pitch: "matar o CDN,
// matar um relay, matar o provider público — o viewer ainda serve via
// NAT provider atrás do relay remanescente". No DNS, no Cloudflare,
// no CDN in the path.
func TestKillSwitchAcrossAllLayers(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	relay1 := startRelayHost(t)
	t.Cleanup(relay1.shutdown)
	relay2 := startRelayHost(t)
	t.Cleanup(relay2.shutdown)

	pubProvider := startDirectProviderHost(t)
	t.Cleanup(pubProvider.shutdown)

	natProvider := startNATProviderHost(t)
	t.Cleanup(natProvider.shutdown)

	viewerHost, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"))
	if err != nil {
		t.Fatalf("viewer: %v", err)
	}
	t.Cleanup(func() { _ = viewerHost.Close() })

	// NAT provider reserves slots on both relays; viewer connects to both
	// relays and registers /p2p-circuit addrs for the NAT provider via
	// each one.
	for _, r := range []*providerNode{relay1, relay2} {
		info := peer.AddrInfo{ID: r.host.ID(), Addrs: r.host.Addrs()}
		if err := natProvider.host.Connect(ctx, info); err != nil {
			t.Fatalf("nat->relay connect: %v", err)
		}
		if _, err := circuitclient.Reserve(ctx, natProvider.host, info); err != nil {
			t.Fatalf("nat reserve on %s: %v", r.host.ID(), err)
		}
		if err := viewerHost.Connect(ctx, info); err != nil {
			t.Fatalf("viewer->relay connect: %v", err)
		}
		circ, _ := multiaddr.NewMultiaddr("/p2p/" + r.host.ID().String() + "/p2p-circuit")
		viewerHost.Peerstore().AddAddr(natProvider.host.ID(), circ, peerstore.PermanentAddrTTL)
	}

	// Viewer also knows the public provider directly.
	viewerHost.Peerstore().AddAddrs(pubProvider.host.ID(), pubProvider.host.Addrs(), peerstore.PermanentAddrTTL)

	resolver := &staticResolver{providers: []peer.ID{pubProvider.host.ID(), natProvider.host.ID()}}
	c := client.New(viewerHost, client.WithResolver(resolver))

	const cid = "baffullstack"

	// Phase 1: full mesh — viewer fetches via first available provider.
	if _, err := c.FetchAndVerifyByCID(ctx, cid); err != nil {
		t.Fatalf("phase 1 fetch: %v", err)
	}

	// Phase 2: kill public provider. Viewer failovers to NAT provider via
	// relay (either R1 or R2 — libp2p's dialer picks one).
	pubProvider.shutdown()
	time.Sleep(500 * time.Millisecond)

	if _, err := c.FetchAndVerifyByCID(ctx, cid); err != nil {
		t.Fatalf("phase 2 fetch (after public provider kill): %v", err)
	}

	// Phase 3: kill one of the two relays. NAT provider still reachable
	// through the remaining relay. Viewer failovers within the circuit
	// dialing logic.
	relay1.shutdown()
	time.Sleep(500 * time.Millisecond)

	if _, err := c.FetchAndVerifyByCID(ctx, cid); err != nil {
		t.Fatalf("phase 3 fetch (after public+relay1 kill): %v", err)
	}
}
