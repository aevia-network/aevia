package httpx_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/peerstore"

	p2phttp "github.com/libp2p/go-libp2p-http"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// newHost spins up a libp2p host with an in-process transport. It registers
// t.Cleanup for shutdown so tests don't leak goroutines.
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

// connect adds b's addrs to a's peerstore and dials, so subsequent streams
// succeed without DHT.
func connect(t *testing.T, a, b host.Host) {
	t.Helper()
	a.Peerstore().AddAddrs(b.ID(), b.Addrs(), peerstore.PermanentAddrTTL)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := a.Connect(ctx, peer.AddrInfo{ID: b.ID(), Addrs: b.Addrs()}); err != nil {
		t.Fatalf("connect: %v", err)
	}
}

func TestHealthzOverLibp2pStream(t *testing.T) {
	serverHost := newHost(t)
	clientHost := newHost(t)
	connect(t, clientHost, serverHost)

	srv := httpx.NewServer(serverHost)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.ServeLibp2p(ctx) }()
	t.Cleanup(func() { _ = srv.Close() })

	// Give the listener a moment to bind to the protocol.
	time.Sleep(50 * time.Millisecond)

	tr := p2phttp.NewTransport(clientHost, p2phttp.ProtocolOption(httpx.DefaultProtocol))
	client := &http.Client{Transport: tr, Timeout: 5 * time.Second}

	resp, err := client.Get("libp2p://" + serverHost.ID().String() + "/healthz")
	if err != nil {
		t.Fatalf("GET /healthz over libp2p: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if got := resp.Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("content-type = %q, want application/json", got)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	var payload struct {
		Status string `json:"status"`
		PeerID string `json:"peer_id"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("unmarshal body: %v (raw=%q)", err, body)
	}
	if payload.Status != "ok" {
		t.Fatalf("status = %q, want ok", payload.Status)
	}
	if payload.PeerID != serverHost.ID().String() {
		t.Fatalf("peer_id = %q, want %q", payload.PeerID, serverHost.ID().String())
	}
}

func TestServerProtocolDefaultsToAevia(t *testing.T) {
	h := newHost(t)
	srv := httpx.NewServer(h)
	if got := srv.Protocol(); got != httpx.DefaultProtocol {
		t.Fatalf("Protocol() = %q, want %q", got, httpx.DefaultProtocol)
	}
}

// TestHealthzIncludesBuildWhenConfigured proves the Phase 0 Strong gate
// check #5 contract: when main.Version is wired via httpx.WithBuild, the
// /healthz JSON response exposes it as `.build`. Gate tooling reads this
// to assert each deployed binary matches HEAD of `main`.
func TestHealthzIncludesBuildWhenConfigured(t *testing.T) {
	h := newHost(t)
	srv := httpx.NewServer(h, httpx.WithBuild("abc1234"))

	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatalf("GET /healthz: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var body struct {
		Build string `json:"build"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Build != "abc1234" {
		t.Fatalf("build = %q, want %q", body.Build, "abc1234")
	}
}

// TestHealthzOmitsBuildWhenNotConfigured guarantees backward compatibility
// with operators running older binaries: when the server is constructed
// without WithBuild, `.build` is absent from the JSON object (omitempty
// behaviour), not present as an empty string. The gate script can then
// distinguish "field missing → older binary" from "field present but wrong
// hash → deploy mismatch".
func TestHealthzOmitsBuildWhenNotConfigured(t *testing.T) {
	h := newHost(t)
	srv := httpx.NewServer(h)

	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatalf("GET /healthz: %v", err)
	}
	defer resp.Body.Close()

	var raw map[string]json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		t.Fatalf("decode raw body: %v", err)
	}
	if _, present := raw["build"]; present {
		t.Fatalf("build key must be absent when WithBuild not used, got %s", raw["build"])
	}
}

func TestServerAcceptsProtocolOverride(t *testing.T) {
	h := newHost(t)
	const custom = "/aevia/http/test/1.0.0"
	srv := httpx.NewServer(h, httpx.WithProtocol(custom))
	if got := srv.Protocol(); string(got) != custom {
		t.Fatalf("Protocol() = %q, want %q", got, custom)
	}
}
