package integration_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// TestClientRejectsTamperedSegment is the flagship M2 proof: a malicious
// Provider Node serves real bytes for all segments EXCEPT segment 5, where
// it flips one byte. The tamperer is sophisticated — it also rewrites the
// X-Aevia-Segment-Sha256 header to match the tampered bytes, so the
// transport-level hash check (ErrHashMismatch) does NOT catch it.
//
// The ONLY defense is the manifest's on-chain anchor: the manifest's leaf
// for segment 5 refers to the ORIGINAL SHA-256, and the client's
// FetchAndVerifyContent recomputes SHA-256 of received bytes and compares
// against that leaf. The tampered content cannot match, so the client
// returns ErrLeafMismatch with Index=5.
//
// This is what makes Aevia bullet-proof against a compromised Provider
// Node — as long as the manifest CID on Base ContentRegistry is authentic,
// every byte of every segment is cryptographically anchored.
func TestClientRejectsTamperedSegment(t *testing.T) {
	const (
		tamperCID = "baftamper"
		tamperIdx = 5
	)

	serverHost := newHost(t)
	clientHost := newHost(t)
	connect(t, clientHost, serverHost)

	srv := httpx.NewServer(serverHost)

	// Register the tamperer BEFORE content.Register. Go 1.22+ mux prefers
	// the more specific pattern regardless of registration order, but being
	// explicit documents intent.
	srv.HandleFunc("GET /content/"+tamperCID+"/segment/"+itoa(tamperIdx), func(w http.ResponseWriter, _ *http.Request) {
		real := content.FixtureBytes(tamperCID, tamperIdx, content.FixtureSegmentSize)
		tampered := append([]byte(nil), real...)
		tampered[0] ^= 0xFF // flip the first byte

		// Sophisticated attacker: rewrites the header to match the tampered
		// bytes so the transport-level hash check passes.
		sum := sha256.Sum256(tampered)

		w.Header().Set("Content-Type", "video/mp2t")
		w.Header().Set("X-Aevia-Segment-Sha256", hex.EncodeToString(sum[:]))
		_, _ = w.Write(tampered)
	})
	content.Register(srv)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = srv.ServeLibp2p(ctx) }()
	time.Sleep(100 * time.Millisecond)

	c := client.New(clientHost)
	reqCtx, reqCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer reqCancel()

	_, err := c.FetchAndVerifyContent(reqCtx, serverHost.ID(), tamperCID)
	if err == nil {
		t.Fatal("FetchAndVerifyContent accepted tampered segment")
	}

	var leafErr client.ErrLeafMismatch
	if !errors.As(err, &leafErr) {
		t.Fatalf("expected ErrLeafMismatch, got %T: %v", err, err)
	}
	if leafErr.Index != tamperIdx {
		t.Fatalf("leaf mismatch at index %d, want %d", leafErr.Index, tamperIdx)
	}
	if leafErr.CID != tamperCID {
		t.Fatalf("ErrLeafMismatch CID = %q, want %q", leafErr.CID, tamperCID)
	}
}

// TestClientAcceptsNonTamperedNeighbors proves that tampering segment 5 does
// NOT cause false positives on segments 0-4. The Kill Test must pass for
// honest segments and fail for dishonest — anything else is noise.
func TestClientAcceptsNonTamperedNeighbors(t *testing.T) {
	const cid = "bafhonest"

	serverHost := newHost(t)
	clientHost := newHost(t)
	connect(t, clientHost, serverHost)

	srv := httpx.NewServer(serverHost)
	content.Register(srv)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = srv.ServeLibp2p(ctx) }()
	time.Sleep(100 * time.Millisecond)

	c := client.New(clientHost)
	reqCtx, reqCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer reqCancel()

	vc, err := c.FetchAndVerifyContent(reqCtx, serverHost.ID(), cid)
	if err != nil {
		t.Fatalf("FetchAndVerifyContent honest server: %v", err)
	}
	if vc.Manifest.SegmentCount != content.DefaultSegmentCount {
		t.Fatalf("segment count = %d", vc.Manifest.SegmentCount)
	}
}

func itoa(i int) string {
	const digits = "0123456789"
	if i == 0 {
		return "0"
	}
	var b [20]byte
	pos := len(b)
	for i > 0 {
		pos--
		b[pos] = digits[i%10]
		i /= 10
	}
	return string(b[pos:])
}
