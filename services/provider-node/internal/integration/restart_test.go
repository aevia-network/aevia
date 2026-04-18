package integration_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"path/filepath"
	"testing"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/peerstore"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

// randomSegments builds n segments of `size` random bytes each.
func randomSegments(t *testing.T, n, size int) [][]byte {
	t.Helper()
	out := make([][]byte, n)
	for i := range out {
		out[i] = make([]byte, size)
		if _, err := rand.Read(out[i]); err != nil {
			t.Fatalf("rand: %v", err)
		}
	}
	return out
}

// serveFromStore boots a libp2p host + httpx.Server with the given
// ContentStore as source. Returns the host and a cleanup func.
func serveFromStore(t *testing.T, cs *pinning.ContentStore) (host.Host, func()) {
	t.Helper()
	h, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"), libp2p.DisableRelay())
	if err != nil {
		t.Fatalf("libp2p.New: %v", err)
	}
	srv := httpx.NewServer(h)
	content.NewHandlers().WithSource(cs).WithFixtureFallback(false).Register(srv)

	ctx, cancel := context.WithCancel(context.Background())
	go func() { _ = srv.ServeLibp2p(ctx) }()
	time.Sleep(75 * time.Millisecond)

	cleanup := func() {
		cancel()
		_ = srv.Close()
		_ = h.Close()
	}
	return h, cleanup
}

// TestContentSurvivesNodeRestart is the flagship M5 proof.
//
// Scenario (filmable — this is the "Provider Node reboota e continua
// servindo" moment):
//
//   Phase 1 (original node):
//     - Open BadgerDB at a tempdir.
//     - Pin random bytes: 5 segments of 2 KiB each.
//     - Record the returned CID and the byte payloads.
//     - Close the store (simulates process termination).
//
//   Phase 2 (fresh libp2p host + content server reading from the same
//   tempdir):
//     - Open BadgerDB at the same path.
//     - Wrap in ContentStore and serve content via libp2p-http.
//     - Viewer connects over libp2p and fetches the playlist + every
//       segment through the Aevia client API.
//
// Assertions:
//   1. FixtureFallback is DISABLED on the server — so any successful
//      byte delivery MUST come from storage, not from the deterministic
//      fixture generator.
//   2. Manifest CID returned from phase 2 exactly matches phase 1.
//   3. Every segment's bytes match the original random payload byte-
//      for-byte.
//   4. Hash verification at the client side (SHA-256 of segment vs
//      manifest leaf) succeeds — proves the cryptographic chain from
//      disk -> libp2p-http -> client is intact across the restart.
//
// This is the empirical proof that a Provider Node rebooting (crash,
// server replace, planned maintenance) does not lose content. It's the
// minimum bar for production readiness.
func TestContentSurvivesNodeRestart(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "badger")

	// ---------- PHASE 1: pin content and close ----------
	originalPayloads := randomSegments(t, 5, 2048)

	store1, err := storage.Open(storage.Options{Path: dir, Silent: true})
	if err != nil {
		t.Fatalf("phase1 open: %v", err)
	}
	cs1 := pinning.NewContentStore(store1)
	originalManifest, err := cs1.PinPayloads(originalPayloads, 6)
	if err != nil {
		t.Fatalf("PinPayloads: %v", err)
	}
	if err := originalManifest.Verify(); err != nil {
		t.Fatalf("phase1 manifest Verify: %v", err)
	}
	originalCID := originalManifest.CID

	// Phase 1 usage snapshot for post-restart assertion.
	phase1Count, phase1Bytes, _ := cs1.Usage()
	if phase1Count != 1 {
		t.Fatalf("phase 1 pin count = %d, want 1", phase1Count)
	}

	if err := store1.Close(); err != nil {
		t.Fatalf("phase1 close: %v", err)
	}

	// ---------- PHASE 2: reopen + serve + fetch ----------
	store2, err := storage.Open(storage.Options{Path: dir, Silent: true})
	if err != nil {
		t.Fatalf("phase2 reopen: %v", err)
	}
	defer store2.Close()
	cs2 := pinning.NewContentStore(store2)

	// Confirm persistence at the ContentStore layer before touching libp2p.
	restoredManifest, err := cs2.GetManifest(originalCID)
	if err != nil {
		t.Fatalf("phase2 GetManifest: %v", err)
	}
	if restoredManifest.CID != originalCID {
		t.Fatalf("phase2 CID = %q, want %q", restoredManifest.CID, originalCID)
	}
	restoredCount, restoredBytes, _ := cs2.Usage()
	if restoredCount != phase1Count {
		t.Fatalf("phase2 pin count = %d, want %d", restoredCount, phase1Count)
	}
	if restoredBytes != phase1Bytes {
		t.Fatalf("phase2 bytes = %d, want %d", restoredBytes, phase1Bytes)
	}

	// Now boot a fresh libp2p host serving this store.
	serverHost, serverCleanup := serveFromStore(t, cs2)
	defer serverCleanup()

	viewerHost, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"), libp2p.DisableRelay())
	if err != nil {
		t.Fatalf("viewer libp2p: %v", err)
	}
	defer viewerHost.Close()

	viewerHost.Peerstore().AddAddrs(serverHost.ID(), serverHost.Addrs(), peerstore.PermanentAddrTTL)
	connectCtx, connectCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer connectCancel()
	if err := viewerHost.Connect(connectCtx, peer.AddrInfo{ID: serverHost.ID(), Addrs: serverHost.Addrs()}); err != nil {
		t.Fatalf("viewer connect: %v", err)
	}

	c := client.New(viewerHost)
	fetchCtx, fetchCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer fetchCancel()

	vc, err := c.FetchAndVerifyContent(fetchCtx, serverHost.ID(), originalCID)
	if err != nil {
		t.Fatalf("FetchAndVerifyContent across restart: %v", err)
	}

	// Assertions: every byte of every segment identical to the original
	// random payload we pinned before Close().
	if vc.Manifest.CID != originalCID {
		t.Fatalf("served manifest CID = %q, want %q", vc.Manifest.CID, originalCID)
	}
	if len(vc.Segments) != len(originalPayloads) {
		t.Fatalf("segment count = %d, want %d", len(vc.Segments), len(originalPayloads))
	}
	for i, seg := range vc.Segments {
		if !bytes.Equal(seg, originalPayloads[i]) {
			t.Fatalf("segment %d mismatch after restart (len got=%d want=%d)", i, len(seg), len(originalPayloads[i]))
		}
	}

	// Belt-and-suspenders: FetchAndVerifyContent already ran the hash
	// chain, but compute it once more from outside to surface any
	// future regression in that path.
	expected, err := manifest.BuildFromPayloads(originalPayloads, 6)
	if err != nil {
		t.Fatalf("rebuild manifest: %v", err)
	}
	if expected.CID != originalCID {
		t.Fatalf("rebuilt CID = %q, want %q", expected.CID, originalCID)
	}
}
