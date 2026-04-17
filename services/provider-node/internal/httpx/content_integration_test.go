package httpx_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"testing"
	"time"

	p2phttp "github.com/libp2p/go-libp2p-http"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// TestSegmentFetchOverLibp2pMatchesFixture proves that an HTTP client fetching
// /content/{cid}/segment/{n} over a libp2p stream receives the same bytes
// that content.FixtureBytes produces locally. This is the shape of the Kill
// Test at the segment level: given only a PeerID and a CID, any client can
// verify it received the right content by hashing it — no trust in the
// transport required.
func TestSegmentFetchOverLibp2pMatchesFixture(t *testing.T) {
	serverHost := newHost(t)
	clientHost := newHost(t)
	connect(t, clientHost, serverHost)

	srv := httpx.NewServer(serverHost)
	content.Register(srv)
	t.Cleanup(func() { _ = srv.Close() })

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = srv.ServeLibp2p(ctx) }()
	time.Sleep(75 * time.Millisecond)

	tr := p2phttp.NewTransport(clientHost, p2phttp.ProtocolOption(httpx.DefaultProtocol))
	client := &http.Client{Transport: tr, Timeout: 5 * time.Second}

	const (
		cid     = "bafybeigtest"
		segment = 3
	)
	resp, err := client.Get("libp2p://" + serverHost.ID().String() + "/content/" + cid + "/segment/3")
	if err != nil {
		t.Fatalf("libp2p GET segment: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "video/mp2t" {
		t.Fatalf("content-type = %q, want video/mp2t", ct)
	}

	got, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}

	expected := content.FixtureBytes(cid, segment, content.FixtureSegmentSize)
	if !bytes.Equal(got, expected) {
		t.Fatalf("libp2p segment bytes differ from local fixture (got %d bytes, want %d)", len(got), len(expected))
	}

	sum := sha256.Sum256(got)
	if gotHash := resp.Header.Get("X-Aevia-Segment-Sha256"); gotHash != hex.EncodeToString(sum[:]) {
		t.Fatalf("server hash header %q does not match computed %x", gotHash, sum)
	}
}
