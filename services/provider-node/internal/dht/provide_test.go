package dht_test

import (
	"context"
	"crypto/sha256"
	"testing"
	"time"

	"github.com/libp2p/go-libp2p/core/peer"

	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

// newPair builds two Aevia DHT nodes, connects them, and returns them ready
// for Provide / FindProviders calls. Used across M3 tests.
func newPair(t *testing.T) (*aeviadht.DHT, *aeviadht.DHT, context.Context) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	t.Cleanup(cancel)

	hostA := newHost(t)
	hostB := newHost(t)

	dhtA, err := aeviadht.New(ctx, hostA, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("dht A: %v", err)
	}
	t.Cleanup(func() { _ = dhtA.Close() })

	dhtB, err := aeviadht.New(ctx, hostB, aeviadht.ModeServer)
	if err != nil {
		t.Fatalf("dht B: %v", err)
	}
	t.Cleanup(func() { _ = dhtB.Close() })

	// Bootstrap A from B and vice versa so both routing tables see the other.
	if err := dhtA.Bootstrap(ctx, []peer.AddrInfo{{ID: hostB.ID(), Addrs: hostB.Addrs()}}); err != nil {
		t.Fatalf("bootstrap A: %v", err)
	}
	if err := dhtB.Bootstrap(ctx, []peer.AddrInfo{{ID: hostA.ID(), Addrs: hostA.Addrs()}}); err != nil {
		t.Fatalf("bootstrap B: %v", err)
	}
	// Give the routing tables a moment to settle.
	time.Sleep(200 * time.Millisecond)

	return dhtA, dhtB, ctx
}

// testCID returns a valid CIDv1 raw that the DHT can parse — same shape as
// the manifest package emits.
func testCID(t *testing.T, seed string) string {
	t.Helper()
	digest := sha256.Sum256([]byte(seed))
	c, err := manifest.CIDv1Raw(digest[:])
	if err != nil {
		t.Fatalf("CIDv1Raw: %v", err)
	}
	return c
}

func TestProvideRejectsInvalidCID(t *testing.T) {
	dhtA, _, ctx := newPair(t)
	if err := dhtA.Provide(ctx, "not-a-cid"); err == nil {
		t.Fatal("Provide accepted invalid CID")
	}
}

func TestProvideAcceptsValidCID(t *testing.T) {
	dhtA, _, ctx := newPair(t)
	cid := testCID(t, "provide-test-1")

	if err := dhtA.Provide(ctx, cid); err != nil {
		t.Fatalf("Provide: %v", err)
	}
}

func TestProvideWithoutInitializationFails(t *testing.T) {
	var d aeviadht.DHT
	if err := d.Provide(context.Background(), "bafkreiabcdef"); err == nil {
		t.Fatal("Provide on uninitialized DHT returned nil error")
	}
}
