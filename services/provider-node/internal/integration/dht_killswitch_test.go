package integration_test

import (
	"context"
	"crypto/sha256"
	"testing"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

// dhtTestCID returns a valid CIDv1 raw that both DHT and content handlers
// can parse, derived from a deterministic seed.
func dhtTestCID(t *testing.T, seed string) string {
	t.Helper()
	d := sha256.Sum256([]byte(seed))
	c, err := manifest.CIDv1Raw(d[:])
	if err != nil {
		t.Fatalf("CIDv1Raw: %v", err)
	}
	return c
}

// providerNode wraps a libp2p host, an httpx.Server running content
// handlers, and a DHT announcing the served CID. Tearing down closes
// everything — used by the Kill Test scenarios in this file.
type providerNode struct {
	host host.Host
	srv  *httpx.Server
	dht  *aeviadht.DHT
	stop context.CancelFunc
}

// startProvider boots the libp2p host, content server, and DHT. It does NOT
// yet call Provide — that requires a non-empty routing table, which only
// exists once at least one peer has connected. The caller drives Provide
// explicitly after the mesh is formed.
func startProvider(t *testing.T, ctx context.Context, bootstrap []peer.AddrInfo) *providerNode {
	t.Helper()

	h, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"), libp2p.DisableRelay())
	if err != nil {
		t.Fatalf("libp2p.New: %v", err)
	}

	srv := httpx.NewServer(h)
	content.Register(srv)

	srvCtx, cancel := context.WithCancel(ctx)
	go func() { _ = srv.ServeLibp2p(srvCtx) }()

	d, err := aeviadht.New(ctx, h, aeviadht.ModeServer)
	if err != nil {
		cancel()
		_ = h.Close()
		t.Fatalf("dht: %v", err)
	}
	if err := d.Bootstrap(ctx, bootstrap); err != nil {
		if len(bootstrap) > 0 {
			cancel()
			_ = d.Close()
			_ = h.Close()
			t.Fatalf("bootstrap: %v", err)
		}
	}

	return &providerNode{host: h, srv: srv, dht: d, stop: cancel}
}

func (p *providerNode) addrInfo() peer.AddrInfo {
	return peer.AddrInfo{ID: p.host.ID(), Addrs: p.host.Addrs()}
}

func (p *providerNode) shutdown() {
	if p == nil {
		return
	}
	if p.stop != nil {
		p.stop()
	}
	if p.srv != nil {
		_ = p.srv.Close()
	}
	if p.dht != nil {
		_ = p.dht.Close()
	}
	if p.host != nil {
		_ = p.host.Close()
	}
}

// TestKillSwitchViaDHT is the flagship proof of M3.
//
// Scenario:
//   - Two Provider Nodes (A and C) announce the SAME CID via DHT.
//   - A viewer (B) boots with a DHT client but NO prior knowledge of A or C.
//   - B queries the DHT by CID alone, receives {A, C}, picks a provider,
//     fetches verified content.
//   - A is then forcibly killed. B retries FetchAndVerifyByCID — this time
//     the failover path routes the request to C.
//
// Pass criteria: both the pre-kill and post-kill fetches return authentic
// content (manifest Verify + per-segment leaf match). No hardcoded PeerID
// is ever passed to B. The ONLY input is the CID.
//
// This is the miniature of the full Aevia Kill Test: the network survives
// the loss of any single provider as long as at least one replica remains.
func TestKillSwitchViaDHT(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cid := dhtTestCID(t, "kill-switch-via-dht-1")

	// Start A first; it has no bootstrap.
	nodeA := startProvider(t, ctx, nil)
	t.Cleanup(nodeA.shutdown)

	// C bootstraps from A. After C connects, A's routing table has C so
	// A's Provide call can succeed.
	nodeC := startProvider(t, ctx, []peer.AddrInfo{nodeA.addrInfo()})
	t.Cleanup(nodeC.shutdown)
	time.Sleep(500 * time.Millisecond)

	if err := nodeA.dht.Provide(ctx, cid); err != nil {
		t.Fatalf("A.Provide: %v", err)
	}
	if err := nodeC.dht.Provide(ctx, cid); err != nil {
		t.Fatalf("C.Provide: %v", err)
	}

	// Viewer B: client DHT, bootstraps from A (just one seed entry point;
	// after that, discovery is fully DHT-driven).
	viewerHost, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"), libp2p.DisableRelay())
	if err != nil {
		t.Fatalf("viewer libp2p: %v", err)
	}
	t.Cleanup(func() { _ = viewerHost.Close() })

	viewerDHT, err := aeviadht.New(ctx, viewerHost, aeviadht.ModeClient)
	if err != nil {
		t.Fatalf("viewer dht: %v", err)
	}
	t.Cleanup(func() { _ = viewerDHT.Close() })

	if err := viewerDHT.Bootstrap(ctx, []peer.AddrInfo{nodeA.addrInfo()}); err != nil {
		t.Fatalf("viewer bootstrap: %v", err)
	}
	time.Sleep(300 * time.Millisecond)

	c := client.New(viewerHost, client.WithResolver(viewerDHT))

	// Phase 1: viewer fetches by CID alone. Should succeed against A or C.
	fetchCtx, fetchCancel := context.WithTimeout(ctx, 15*time.Second)
	vc, err := c.FetchAndVerifyByCID(fetchCtx, cid)
	fetchCancel()
	if err != nil {
		t.Fatalf("phase 1 FetchAndVerifyByCID: %v", err)
	}
	if vc.Manifest.SegmentCount != content.DefaultSegmentCount {
		t.Fatalf("phase 1 segment count = %d", vc.Manifest.SegmentCount)
	}

	// Phase 2: KILL node A. Viewer keeps working because C still announces
	// the same CID and serves the same content.
	nodeA.shutdown()
	// Let the connection states update.
	time.Sleep(500 * time.Millisecond)

	fetchCtx2, fetchCancel2 := context.WithTimeout(ctx, 15*time.Second)
	vc2, err := c.FetchAndVerifyByCID(fetchCtx2, cid)
	fetchCancel2()
	if err != nil {
		t.Fatalf("phase 2 (post-kill) FetchAndVerifyByCID: %v", err)
	}
	if vc2.Manifest.SegmentCount != content.DefaultSegmentCount {
		t.Fatalf("phase 2 segment count = %d", vc2.Manifest.SegmentCount)
	}
	if vc2.Manifest.CID != vc.Manifest.CID {
		t.Fatalf("phase 1 and phase 2 returned different CIDs: %s vs %s", vc.Manifest.CID, vc2.Manifest.CID)
	}
}
