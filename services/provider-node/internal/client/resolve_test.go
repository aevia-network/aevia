package client_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/libp2p/go-libp2p/core/peer"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
)

// fakeResolver is a trivial Resolver for testing the Client wrapper without
// standing up a real DHT.
type fakeResolver struct {
	providers []peer.ID
	err       error
}

func (f *fakeResolver) FindProviders(_ context.Context, _ string, limit int) ([]peer.ID, error) {
	if f.err != nil {
		return nil, f.err
	}
	if limit > 0 && len(f.providers) > limit {
		return f.providers[:limit], nil
	}
	return f.providers, nil
}

func TestResolveProvidersReturnsNoResolverWhenUnset(t *testing.T) {
	h := newHost(t)
	c := client.New(h)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	_, err := c.ResolveProviders(ctx, "bafkreiabc", 5)
	if !errors.Is(err, client.ErrNoResolver) {
		t.Fatalf("expected ErrNoResolver, got %v", err)
	}
}

func TestResolveProvidersReturnsNoProvidersWhenEmpty(t *testing.T) {
	h := newHost(t)
	c := client.New(h, client.WithResolver(&fakeResolver{providers: nil}))
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	_, err := c.ResolveProviders(ctx, "bafkreiabc", 5)
	var notFound client.ErrNoProviders
	if !errors.As(err, &notFound) {
		t.Fatalf("expected ErrNoProviders, got %T: %v", err, err)
	}
	if notFound.CID != "bafkreiabc" {
		t.Fatalf("ErrNoProviders.CID = %q, want bafkreiabc", notFound.CID)
	}
}

func TestResolveProvidersPassesThrough(t *testing.T) {
	h := newHost(t)
	srv := newHost(t)
	c := client.New(h, client.WithResolver(&fakeResolver{providers: []peer.ID{srv.ID()}}))

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	got, err := c.ResolveProviders(ctx, "bafkreiabc", 5)
	if err != nil {
		t.Fatalf("ResolveProviders: %v", err)
	}
	if len(got) != 1 || got[0] != srv.ID() {
		t.Fatalf("unexpected providers: %v", got)
	}
}
