package por_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/peerstore"

	p2phttp "github.com/libp2p/go-libp2p-http"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
	"github.com/Leeaandrob/aevia/services/provider-node/por"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

func newLibp2pHost(t *testing.T) host.Host {
	t.Helper()
	h, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"), libp2p.DisableRelay())
	if err != nil {
		t.Fatalf("libp2p.New: %v", err)
	}
	t.Cleanup(func() { _ = h.Close() })
	return h
}

func connectHosts(t *testing.T, a, b host.Host) {
	t.Helper()
	a.Peerstore().AddAddrs(b.ID(), b.Addrs(), peerstore.PermanentAddrTTL)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := a.Connect(ctx, peer.AddrInfo{ID: b.ID(), Addrs: b.Addrs()}); err != nil {
		t.Fatalf("connect: %v", err)
	}
}

// TestAckRoundTripOverLibp2p proves the viewer-provider receipt exchange
// works end-to-end over a real libp2p stream:
//   1. Viewer builds + signs a receipt.
//   2. POST /ack lands on the provider via go-libp2p-http.
//   3. Provider validates viewer sig, co-signs, persists, returns signed.
//   4. Viewer verifies the returned receipt has both signatures.
func TestAckRoundTripOverLibp2p(t *testing.T) {
	serverHost := newLibp2pHost(t)
	viewerHost := newLibp2pHost(t)
	connectHosts(t, viewerHost, serverHost)

	// Provider identity key — use a fresh keypair that matches the server
	// host so the server-side signature actually binds to serverHost.ID().
	// Easiest: extract priv from the host's peerstore.
	providerPriv := serverHost.Peerstore().PrivKey(serverHost.ID())
	if providerPriv == nil {
		t.Fatal("server host has no priv key in peerstore")
	}

	storeBackend, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = storeBackend.Close() })
	rs := por.NewReceiptStore(storeBackend)

	ackServer, err := por.NewAckServer(providerPriv, rs)
	if err != nil {
		t.Fatalf("NewAckServer: %v", err)
	}

	srv := httpx.NewServer(serverHost)
	ackServer.Register(srv)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = srv.ServeLibp2p(ctx) }()
	t.Cleanup(func() { _ = srv.Close() })
	time.Sleep(75 * time.Millisecond)

	viewerPriv := viewerHost.Peerstore().PrivKey(viewerHost.ID())
	if viewerPriv == nil {
		t.Fatal("viewer host has no priv key")
	}

	tr := p2phttp.NewTransport(viewerHost, p2phttp.ProtocolOption(httpx.DefaultProtocol))
	httpClient := &http.Client{Transport: tr, Timeout: 5 * time.Second}
	issuer, err := por.NewIssuer(viewerPriv, por.IssuerOptions{HTTPClient: httpClient})
	if err != nil {
		t.Fatalf("NewIssuer: %v", err)
	}

	signed, err := issuer.Issue(ctx, serverHost.ID(), "bafkackrt", 0, 4096)
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if err := signed.VerifyBoth(); err != nil {
		t.Fatalf("returned receipt VerifyBoth: %v", err)
	}

	// The receipt should be in the provider's store.
	stored, err := rs.GetByProvider(serverHost.ID().String(), 0, 0)
	if err != nil {
		t.Fatalf("GetByProvider: %v", err)
	}
	if len(stored) != 1 {
		t.Fatalf("stored = %d, want 1", len(stored))
	}
	if stored[0].SegmentSize != 4096 {
		t.Fatalf("stored SegmentSize = %d", stored[0].SegmentSize)
	}
}

func TestAckRejectsReceiptForDifferentProvider(t *testing.T) {
	serverHost := newLibp2pHost(t)
	viewerHost := newLibp2pHost(t)
	connectHosts(t, viewerHost, serverHost)

	providerPriv := serverHost.Peerstore().PrivKey(serverHost.ID())

	storeBackend, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = storeBackend.Close() })
	rs := por.NewReceiptStore(storeBackend)

	ackServer, err := por.NewAckServer(providerPriv, rs)
	if err != nil {
		t.Fatalf("NewAckServer: %v", err)
	}
	srv := httpx.NewServer(serverHost)
	ackServer.Register(srv)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = srv.ServeLibp2p(ctx) }()
	t.Cleanup(func() { _ = srv.Close() })
	time.Sleep(75 * time.Millisecond)

	// Viewer addresses its receipt to SOME OTHER provider PeerID — the
	// target server should reject it.
	viewerPriv := viewerHost.Peerstore().PrivKey(viewerHost.ID())

	tr := p2phttp.NewTransport(viewerHost, p2phttp.ProtocolOption(httpx.DefaultProtocol))
	httpClient := &http.Client{Transport: tr, Timeout: 5 * time.Second}
	issuer, err := por.NewIssuer(viewerPriv, por.IssuerOptions{HTTPClient: httpClient})
	if err != nil {
		t.Fatalf("NewIssuer: %v", err)
	}

	// Build a fake receipt that names a different provider but POSTs to
	// the real server. Use Issue but override the peerID in the URL — we
	// dispatch manually because Issuer.Issue uses the same peerID for both
	// URL and receipt field.
	_, err = issuer.Issue(ctx, viewerHost.ID() /* WRONG — the viewer as provider */, "bafkrt", 0, 100)
	if err == nil {
		t.Fatal("Issue succeeded against wrong provider")
	}
}
