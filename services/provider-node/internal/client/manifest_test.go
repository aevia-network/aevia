package client_test

import (
	"context"
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
)

func TestClientFetchManifestSelfConsistent(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	m, err := c.FetchManifest(ctx, srvHost.ID(), "baf9k")
	if err != nil {
		t.Fatalf("FetchManifest: %v", err)
	}
	if m.SegmentCount != content.DefaultSegmentCount {
		t.Fatalf("segment_count = %d, want %d", m.SegmentCount, content.DefaultSegmentCount)
	}
}

func TestClientFetchManifestExpectingCIDAccepts(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	// Resolve the expected CID by building the manifest locally with the
	// same seed the server uses.
	expected, err := content.BuildFixtureManifest("baf9k")
	if err != nil {
		t.Fatalf("BuildFixtureManifest: %v", err)
	}

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	got, err := c.FetchManifestExpectingCID(ctx, srvHost.ID(), "baf9k", expected.CID)
	if err != nil {
		t.Fatalf("FetchManifestExpectingCID: %v", err)
	}
	if got.CID != expected.CID {
		t.Fatalf("CID mismatch: got=%s expected=%s", got.CID, expected.CID)
	}
}

func TestClientFetchManifestExpectingCIDRejectsMismatch(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// A CID that almost certainly does not match the fixture.
	wrongCID := "bafkreiabcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqr"

	if _, err := c.FetchManifestExpectingCID(ctx, srvHost.ID(), "baf9k", wrongCID); err == nil {
		t.Fatal("FetchManifestExpectingCID accepted mismatched expected CID")
	}
}
