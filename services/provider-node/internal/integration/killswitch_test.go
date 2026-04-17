// Package integration hosts end-to-end tests that exercise the Provider
// Node through its public transport surface. The flagship test in this
// package — TestKillSwitchHLSEndToEnd — is the in-process rehearsal of the
// real Kill Test demo: given only (PeerID, CID), a client can fetch the
// complete HLS content via libp2p stream, and every byte matches what the
// same client fetches via plain HTTP. No DNS, no CDN, no trust in transport.
package integration_test

import (
	"bytes"
	"context"
	"io"
	"net"
	"net/http"
	"strconv"
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

// TestKillSwitchHLSEndToEnd is the lab-scale rehearsal of the real Kill
// Test demo.
//
// SETUP:
//   - Server host boots an httpx.Server with content.Register on two
//     transports simultaneously: a libp2p stream listener
//     (/aevia/http/1.0.0) AND a plain TCP listener on 127.0.0.1:0.
//   - Client host is a separate libp2p instance connected to the server.
//
// ASSERTIONS:
//  1. Plain HTTP GET /content/<cid>/index.m3u8 and libp2p GET same path
//     return byte-equal playlists.
//  2. For all 10 default segments: plain HTTP and libp2p fetches return
//     byte-equal bodies.
//  3. Client-side hash verification succeeds on every libp2p fetch — that
//     is, the server-reported X-Aevia-Segment-Sha256 header matches the
//     received bytes.
//
// This is what the filmed Kill Test produces on stage at 1:1 scale: the
// viewer never notices Cloudflare is off because the libp2p transport
// serves bytes that are bit-identical to what the CDN would have served.
func TestKillSwitchHLSEndToEnd(t *testing.T) {
	const cid = "bafy2bzacekillswitch"

	serverHost := newHost(t)
	clientHost := newHost(t)
	connect(t, clientHost, serverHost)

	srv := httpx.NewServer(serverHost)
	content.Register(srv)
	t.Cleanup(func() { _ = srv.Close() })

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	// Plain TCP transport (Provider Público role).
	tcpListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	tcpAddr := tcpListener.Addr().String()
	go func() { _ = srv.ServeHTTPOn(ctx, tcpListener) }()

	// libp2p stream transport (Provider NAT role).
	go func() { _ = srv.ServeLibp2p(ctx) }()

	// Let both listeners register protocol handlers.
	time.Sleep(100 * time.Millisecond)

	tcpClient := &http.Client{Timeout: 5 * time.Second}
	p2pClient := client.New(clientHost)
	reqCtx, reqCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer reqCancel()

	// Step 1: playlist byte-equality across transports.
	plainPlaylist, err := fetchPlain(tcpClient, "http://"+tcpAddr+"/content/"+cid+"/index.m3u8")
	if err != nil {
		t.Fatalf("plain playlist: %v", err)
	}
	p2pPlaylist, err := p2pClient.FetchPlaylist(reqCtx, serverHost.ID(), cid)
	if err != nil {
		t.Fatalf("libp2p playlist: %v", err)
	}
	if string(plainPlaylist) != p2pPlaylist {
		t.Fatalf("playlist mismatch between transports:\nplain=%q\nlibp2p=%q", plainPlaylist, p2pPlaylist)
	}
	if !strings.Contains(p2pPlaylist, "#EXTM3U") {
		t.Fatalf("playlist missing #EXTM3U: %s", p2pPlaylist)
	}

	// Step 2: every segment byte-equal across transports AND hash-verified
	// on the libp2p path.
	for i := 0; i < content.DefaultSegmentCount; i++ {
		plain, err := fetchPlain(tcpClient, "http://"+tcpAddr+"/content/"+cid+"/segment/"+strconv.Itoa(i))
		if err != nil {
			t.Fatalf("plain segment %d: %v", i, err)
		}
		p2p, err := p2pClient.FetchSegment(reqCtx, serverHost.ID(), cid, i)
		if err != nil {
			t.Fatalf("libp2p segment %d: %v", i, err)
		}
		if !bytes.Equal(plain, p2p) {
			t.Fatalf("segment %d: plain and libp2p bytes differ (len plain=%d len p2p=%d)", i, len(plain), len(p2p))
		}
		want := content.FixtureBytes(cid, i, content.FixtureSegmentSize)
		if !bytes.Equal(plain, want) {
			t.Fatalf("segment %d: plain bytes differ from local fixture", i)
		}
	}
}

// TestKillSwitchPlainOnlyFailsAfterShutdown proves the inverse of the Kill
// Test: if the libp2p transport is NOT running, the client fails. This is
// the control — without libp2p, the Kill Test is merely a CDN test.
func TestKillSwitchPlainOnlyFailsAfterShutdown(t *testing.T) {
	const cid = "bafcontrol"

	serverHost := newHost(t)
	clientHost := newHost(t)
	connect(t, clientHost, serverHost)

	srv := httpx.NewServer(serverHost)
	content.Register(srv)

	ctx, cancel := context.WithCancel(context.Background())
	tcpListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	go func() { _ = srv.ServeHTTPOn(ctx, tcpListener) }()
	// NOTE: libp2p transport is intentionally not started.

	time.Sleep(75 * time.Millisecond)

	p2pClient := client.New(clientHost)
	reqCtx, reqCancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer reqCancel()

	if _, err := p2pClient.FetchPlaylist(reqCtx, serverHost.ID(), cid); err == nil {
		t.Fatal("FetchPlaylist succeeded with libp2p transport off; expected failure")
	}

	cancel()
	_ = srv.Close()
}

func fetchPlain(c *http.Client, url string) ([]byte, error) {
	resp, err := c.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, ErrNon200{Code: resp.StatusCode, URL: url}
	}
	return io.ReadAll(resp.Body)
}

type ErrNon200 struct {
	Code int
	URL  string
}

func (e ErrNon200) Error() string {
	return "non-200 status " + strconv.Itoa(e.Code) + " from " + e.URL
}
