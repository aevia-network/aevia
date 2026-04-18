package integration_test

import (
	"context"
	"testing"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/peerstore"
	circuitclient "github.com/libp2p/go-libp2p/p2p/protocol/circuitv2/client"
	relayv2 "github.com/libp2p/go-libp2p/p2p/protocol/circuitv2/relay"
	"github.com/multiformats/go-multiaddr"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// startRelayHost builds a Circuit Relay v2 HOP host with AutoNAT service
// and public reachability forced. Used by integration tests that simulate
// a VPS-deployed Relay Node.
func startRelayHost(t *testing.T) *providerNode {
	t.Helper()
	h, err := libp2p.New(
		libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"),
		libp2p.EnableRelayService(relayv2.WithInfiniteLimits()),
		libp2p.EnableNATService(),
		libp2p.ForceReachabilityPublic(),
	)
	if err != nil {
		t.Fatalf("relay libp2p.New: %v", err)
	}
	_, cancel := context.WithCancel(context.Background())
	return &providerNode{host: h, stop: cancel}
}

// startNATProviderHost simulates a Provider Node behind NAT: forced
// private reachability, listening on loopback so it cannot be dialed
// directly by the viewer.
func startNATProviderHost(t *testing.T) *providerNode {
	t.Helper()
	h, err := libp2p.New(
		libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"),
		libp2p.ForceReachabilityPrivate(),
	)
	if err != nil {
		t.Fatalf("nat-provider libp2p.New: %v", err)
	}
	srv := httpx.NewServer(h)
	content.Register(srv)

	ctx, cancel := context.WithCancel(context.Background())
	go func() { _ = srv.ServeLibp2p(ctx) }()

	return &providerNode{host: h, stop: cancel, srv: srv}
}

// TestProviderNATServedViaRelay is the flagship M4 proof.
//
// Scenario:
//   - A Relay Node (public reachability, Circuit Relay v2 HOP on) sits
//     in the middle.
//   - A NAT Provider Node reserves a circuit slot on the relay and serves
//     content via libp2p-http. It never exposes a directly-dialable
//     address to the viewer.
//   - A Viewer knows only the NAT provider's PeerID — and in its
//     peerstore, the ONLY address for that PeerID is a /p2p-circuit
//     routed through the relay.
//
// When the viewer calls FetchAndVerifyContent, the libp2p dialer routes
// the connection through the relay. The HTTP request traverses the
// circuit, content.Register handles it on the NAT provider, bytes come
// back through the same circuit. The viewer's hash-verify pipeline
// confirms byte-identical content to the local fixture.
//
// This is the empirical proof for "igreja atrás de CGNAT pode servir
// conteúdo ao mundo via Relay Node". The only third-party dependency
// in the path is the Relay Node — no Cloudflare, no DNS, no CDN.
func TestProviderNATServedViaRelay(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	relayHost := startRelayHost(t)
	t.Cleanup(relayHost.shutdown)

	natProvider := startNATProviderHost(t)
	t.Cleanup(natProvider.shutdown)

	viewerHost, err := libp2p.New(
		libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"),
	)
	if err != nil {
		t.Fatalf("viewer libp2p.New: %v", err)
	}
	t.Cleanup(func() { _ = viewerHost.Close() })

	relayInfo := peer.AddrInfo{ID: relayHost.host.ID(), Addrs: relayHost.host.Addrs()}

	// NAT provider connects to relay and reserves a circuit slot.
	if err := natProvider.host.Connect(ctx, relayInfo); err != nil {
		t.Fatalf("nat provider connect to relay: %v", err)
	}
	if _, err := circuitclient.Reserve(ctx, natProvider.host, relayInfo); err != nil {
		t.Fatalf("nat provider reserve: %v", err)
	}

	// Viewer connects to relay too — required for the outbound circuit to
	// the NAT provider.
	if err := viewerHost.Connect(ctx, relayInfo); err != nil {
		t.Fatalf("viewer connect to relay: %v", err)
	}

	// Viewer's peerstore: the NAT provider is known ONLY via its circuit
	// address. No direct IP/port is ever given to the viewer.
	circuitAddrStr := "/p2p/" + relayHost.host.ID().String() + "/p2p-circuit"
	circuitAddr, err := multiaddr.NewMultiaddr(circuitAddrStr)
	if err != nil {
		t.Fatalf("circuit multiaddr: %v", err)
	}
	viewerHost.Peerstore().AddAddr(natProvider.host.ID(), circuitAddr, peerstore.PermanentAddrTTL)

	// Fire up a client against the NAT provider via its PeerID — the
	// underlying libp2p-http dialer will route through the relay.
	c := client.New(viewerHost)

	const cid = "bafnatrelay"
	vc, err := c.FetchAndVerifyContent(ctx, natProvider.host.ID(), cid)
	if err != nil {
		t.Fatalf("FetchAndVerifyContent via circuit: %v", err)
	}
	if vc.Manifest.SegmentCount != content.DefaultSegmentCount {
		t.Fatalf("segment_count = %d", vc.Manifest.SegmentCount)
	}
}

// TestKillSwitchRelayFailover proves two-relay resilience: two Relay Nodes
// are both connected to a NAT Provider and both carry reservations for
// it. The viewer has both /p2p-circuit addrs in its peerstore. Kill the
// first relay — the second one takes over the circuit dial transparently.
func TestKillSwitchRelayFailover(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	relay1 := startRelayHost(t)
	t.Cleanup(relay1.shutdown)
	relay2 := startRelayHost(t)
	t.Cleanup(relay2.shutdown)

	natProvider := startNATProviderHost(t)
	t.Cleanup(natProvider.shutdown)

	viewerHost, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"))
	if err != nil {
		t.Fatalf("viewer: %v", err)
	}
	t.Cleanup(func() { _ = viewerHost.Close() })

	for _, r := range []*providerNode{relay1, relay2} {
		info := peer.AddrInfo{ID: r.host.ID(), Addrs: r.host.Addrs()}
		if err := natProvider.host.Connect(ctx, info); err != nil {
			t.Fatalf("nat->relay connect: %v", err)
		}
		if _, err := circuitclient.Reserve(ctx, natProvider.host, info); err != nil {
			t.Fatalf("reserve on %s: %v", r.host.ID(), err)
		}
		if err := viewerHost.Connect(ctx, info); err != nil {
			t.Fatalf("viewer->relay connect: %v", err)
		}
		circ, _ := multiaddr.NewMultiaddr("/p2p/" + r.host.ID().String() + "/p2p-circuit")
		viewerHost.Peerstore().AddAddr(natProvider.host.ID(), circ, peerstore.PermanentAddrTTL)
	}

	c := client.New(viewerHost)

	const cid = "bafrelayfail"

	// Phase 1 — full mesh.
	if _, err := c.FetchAndVerifyContent(ctx, natProvider.host.ID(), cid); err != nil {
		t.Fatalf("phase 1 fetch: %v", err)
	}

	// Phase 2 — kill relay1.
	relay1.shutdown()
	// Allow connection state propagation.
	time.Sleep(500 * time.Millisecond)

	if _, err := c.FetchAndVerifyContent(ctx, natProvider.host.ID(), cid); err != nil {
		t.Fatalf("phase 2 fetch (after relay1 kill): %v", err)
	}
}
