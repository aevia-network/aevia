package client_test

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/peerstore"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
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

func connect(t *testing.T, a, b host.Host) {
	t.Helper()
	a.Peerstore().AddAddrs(b.ID(), b.Addrs(), peerstore.PermanentAddrTTL)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := a.Connect(ctx, peer.AddrInfo{ID: b.ID(), Addrs: b.Addrs()}); err != nil {
		t.Fatalf("connect: %v", err)
	}
}

// bootServer spins up an httpx.Server with content handlers on srvHost and
// returns when the libp2p stream listener is ready.
func bootServer(t *testing.T, srvHost host.Host) (*httpx.Server, context.CancelFunc) {
	t.Helper()
	srv := httpx.NewServer(srvHost)
	content.Register(srv)
	ctx, cancel := context.WithCancel(context.Background())
	go func() { _ = srv.ServeLibp2p(ctx) }()
	time.Sleep(75 * time.Millisecond)
	t.Cleanup(func() {
		cancel()
		_ = srv.Close()
	})
	return srv, cancel
}

func TestClientFetchesHealthz(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	body, err := c.Healthz(ctx, srvHost.ID())
	if err != nil {
		t.Fatalf("Healthz: %v", err)
	}
	if !strings.Contains(body, `"status":"ok"`) {
		t.Fatalf("healthz body missing status ok: %s", body)
	}
	if !strings.Contains(body, srvHost.ID().String()) {
		t.Fatalf("healthz body missing peer_id %s: %s", srvHost.ID(), body)
	}
}

func TestClientFetchesPlaylist(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	body, err := c.FetchPlaylist(ctx, srvHost.ID(), "baf123")
	if err != nil {
		t.Fatalf("FetchPlaylist: %v", err)
	}
	if !strings.Contains(body, "#EXTM3U") {
		t.Fatalf("playlist missing #EXTM3U: %s", body)
	}
	if !strings.Contains(body, "segment/0") {
		t.Fatal("playlist missing segment/0 reference")
	}
}

func TestClientFetchSegmentVerifiesHash(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	const cid = "baf123"
	const idx = 5

	got, err := c.FetchSegment(ctx, srvHost.ID(), cid, idx)
	if err != nil {
		t.Fatalf("FetchSegment: %v", err)
	}
	want := content.FixtureBytes(cid, idx, content.FixtureSegmentSize)
	if !bytes.Equal(got, want) {
		t.Fatalf("segment bytes differ from local fixture (got %d, want %d)", len(got), len(want))
	}
}

func TestClientFetchAllSegmentsFromPlaylist(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	const cid = "bafintegration"
	_, err := c.FetchPlaylist(ctx, srvHost.ID(), cid)
	if err != nil {
		t.Fatalf("FetchPlaylist: %v", err)
	}

	for i := 0; i < content.DefaultSegmentCount; i++ {
		b, err := c.FetchSegment(ctx, srvHost.ID(), cid, i)
		if err != nil {
			t.Fatalf("segment %d: %v", i, err)
		}
		want := content.FixtureBytes(cid, i, content.FixtureSegmentSize)
		if !bytes.Equal(b, want) {
			t.Fatalf("segment %d bytes differ from fixture", i)
		}
	}
}

func TestClientFetchSegmentRejectsNegativeIndex(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	_, err := c.FetchSegment(ctx, srvHost.ID(), "baf", -1)
	if err == nil {
		t.Fatal("FetchSegment(-1) returned nil error")
	}
}

// Ensure ErrHashMismatch is comparable / identifiable.
func TestErrHashMismatchIsRecognizable(t *testing.T) {
	var target client.ErrHashMismatch
	e := client.ErrHashMismatch{CID: "baf", Index: 3, Claimed: "aa", Actual: "bb"}
	if !errors.As(e, &target) {
		t.Fatal("errors.As did not match ErrHashMismatch")
	}
	if target.CID != "baf" || target.Index != 3 {
		t.Fatalf("target not populated correctly: %+v", target)
	}
}
