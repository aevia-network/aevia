package client_test

import (
	"context"
	"testing"
	"time"

	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/peerstore"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
)

// TestFetchAndVerifyByCIDAgainstSingleProvider drives the CID-only flow
// with an injected fakeResolver pointing at a live server host. This
// isolates the client-side logic (resolve -> connect -> fetch -> verify)
// from the DHT package; the full DHT-backed scenario lives in M3-i8.
func TestFetchAndVerifyByCIDAgainstSingleProvider(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)

	// Seed the client's peerstore with the server's addresses so
	// ensureConnected has somewhere to dial.
	cliHost.Peerstore().AddAddrs(srvHost.ID(), srvHost.Addrs(), peerstore.PermanentAddrTTL)

	bootServer(t, srvHost)

	c := client.New(cliHost, client.WithResolver(&fakeResolver{providers: []peer.ID{srvHost.ID()}}))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	const cid = "bafbycid"
	vc, err := c.FetchAndVerifyByCID(ctx, cid)
	if err != nil {
		t.Fatalf("FetchAndVerifyByCID: %v", err)
	}
	if vc.Manifest.SegmentCount != content.DefaultSegmentCount {
		t.Fatalf("segment_count = %d", vc.Manifest.SegmentCount)
	}
}

func TestFetchAndVerifyByCIDFailsWhenNoProviders(t *testing.T) {
	cliHost := newHost(t)
	c := client.New(cliHost, client.WithResolver(&fakeResolver{providers: nil}))
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if _, err := c.FetchAndVerifyByCID(ctx, "bafnone"); err == nil {
		t.Fatal("FetchAndVerifyByCID succeeded with no providers")
	}
}

func TestFetchAndVerifyByCIDFailsOverToSecondProvider(t *testing.T) {
	deadHost := newHost(t)
	// Capture the PeerID and then close the host so it's unreachable.
	deadID := deadHost.ID()
	_ = deadHost.Close()

	srvHost := newHost(t)
	cliHost := newHost(t)
	cliHost.Peerstore().AddAddrs(srvHost.ID(), srvHost.Addrs(), peerstore.PermanentAddrTTL)
	bootServer(t, srvHost)

	resolver := &fakeResolver{providers: []peer.ID{deadID, srvHost.ID()}}
	c := client.New(cliHost, client.WithResolver(resolver))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	const cid = "bafailover"
	vc, err := c.FetchAndVerifyByCID(ctx, cid)
	if err != nil {
		t.Fatalf("FetchAndVerifyByCID failover: %v", err)
	}
	if vc.Manifest.SegmentCount != content.DefaultSegmentCount {
		t.Fatal("manifest segment count off")
	}
}
