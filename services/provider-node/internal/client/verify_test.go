package client_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/client"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
)

func TestFetchAndVerifyContentReturnsAllSegments(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	const cid = "bafverify"
	vc, err := c.FetchAndVerifyContent(ctx, srvHost.ID(), cid)
	if err != nil {
		t.Fatalf("FetchAndVerifyContent: %v", err)
	}

	if vc.Manifest == nil {
		t.Fatal("Manifest is nil")
	}
	if len(vc.Segments) != vc.Manifest.SegmentCount {
		t.Fatalf("len(segments) = %d, want %d", len(vc.Segments), vc.Manifest.SegmentCount)
	}

	for i, seg := range vc.Segments {
		want := content.FixtureBytes(cid, i, content.FixtureSegmentSize)
		if !bytes.Equal(seg, want) {
			t.Fatalf("segment %d differs from fixture", i)
		}
		sum := sha256.Sum256(seg)
		if hex.EncodeToString(sum[:]) != vc.Manifest.Leaves[i] {
			t.Fatalf("segment %d hash %x != manifest leaf %s", i, sum, vc.Manifest.Leaves[i])
		}
	}
}

func TestFetchAndVerifyContentHandlesConcurrentCalls(t *testing.T) {
	srvHost := newHost(t)
	cliHost := newHost(t)
	connect(t, cliHost, srvHost)
	bootServer(t, srvHost)

	c := client.New(cliHost)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	const cid = "bafconc"
	const workers = 4

	errs := make(chan error, workers)
	for i := 0; i < workers; i++ {
		go func() {
			_, err := c.FetchAndVerifyContent(ctx, srvHost.ID(), cid)
			errs <- err
		}()
	}
	for i := 0; i < workers; i++ {
		if err := <-errs; err != nil {
			t.Fatalf("worker %d: %v", i, err)
		}
	}
}
