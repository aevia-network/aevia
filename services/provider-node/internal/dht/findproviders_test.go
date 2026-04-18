package dht_test

import (
	"context"
	"testing"
	"time"
)

func TestFindProvidersRejectsInvalidCID(t *testing.T) {
	dhtA, _, ctx := newPair(t)
	if _, err := dhtA.FindProviders(ctx, "not-a-cid", 10); err == nil {
		t.Fatal("FindProviders accepted invalid CID")
	}
}

// TestProvideThenFindRoundTrip is the first empirical proof of decentralized
// discovery: host A announces a CID, host B queries the DHT by CID, B's
// result set includes A's PeerID. No explicit introduction between A and B
// at the CID level — everything flows through the Kademlia provider record.
func TestProvideThenFindRoundTrip(t *testing.T) {
	dhtA, dhtB, ctx := newPair(t)
	cid := testCID(t, "round-trip-1")

	if err := dhtA.Provide(ctx, cid); err != nil {
		t.Fatalf("A.Provide: %v", err)
	}

	// Provider records propagate synchronously in the 2-node case, but we
	// allow a small window for routing-table settling.
	findCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	providers, err := dhtB.FindProviders(findCtx, cid, 10)
	if err != nil {
		t.Fatalf("B.FindProviders: %v", err)
	}
	if len(providers) == 0 {
		t.Fatal("B received zero providers; expected A")
	}

	found := false
	for _, pid := range providers {
		if pid == dhtA.Host().ID() {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("A's PeerID not in provider set: %v (wanted %s)", providers, dhtA.Host().ID())
	}
}

func TestFindProvidersHonoursLimit(t *testing.T) {
	dhtA, dhtB, ctx := newPair(t)
	cid := testCID(t, "limit-test")
	if err := dhtA.Provide(ctx, cid); err != nil {
		t.Fatalf("Provide: %v", err)
	}

	// Limit = 1 — even if multiple providers existed, only 1 is returned.
	findCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	got, err := dhtB.FindProviders(findCtx, cid, 1)
	if err != nil {
		t.Fatalf("FindProviders: %v", err)
	}
	if len(got) > 1 {
		t.Fatalf("len(got) = %d, want <= 1", len(got))
	}
}

func TestFindProvidersNoResultsWhenNothingProvided(t *testing.T) {
	_, dhtB, ctx := newPair(t)
	cid := testCID(t, "never-provided")

	findCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	got, err := dhtB.FindProviders(findCtx, cid, 5)
	if err != nil {
		t.Fatalf("FindProviders: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected 0 providers for unannounced CID, got %v", got)
	}
}
