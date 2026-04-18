package dht_test

import (
	"context"
	"testing"
	"time"
)

func TestProvideAllAttemptsEveryCID(t *testing.T) {
	dhtA, dhtB, ctx := newPair(t)

	cidX := testCID(t, "provide-all-x")
	cidY := testCID(t, "provide-all-y")

	if err := dhtA.ProvideAll(ctx, []string{cidX, cidY}); err != nil {
		t.Fatalf("ProvideAll: %v", err)
	}

	findCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	for _, c := range []string{cidX, cidY} {
		providers, err := dhtB.FindProviders(findCtx, c, 5)
		if err != nil {
			t.Fatalf("FindProviders(%s): %v", c, err)
		}
		if len(providers) == 0 {
			t.Fatalf("no providers for %s", c)
		}
	}
}

func TestProvideAllReturnsFirstError(t *testing.T) {
	dhtA, _, ctx := newPair(t)

	valid := testCID(t, "ok-1")
	err := dhtA.ProvideAll(ctx, []string{"garbage", valid})
	if err == nil {
		t.Fatal("expected error from first invalid CID")
	}
}

// TestRefreshLoopProvidesImmediately asserts the loop calls ProvideAll
// synchronously on entry so the first announcement does not wait one tick.
func TestRefreshLoopProvidesImmediately(t *testing.T) {
	dhtA, dhtB, ctx := newPair(t)
	cid := testCID(t, "refresh-immediate")

	loopCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		dhtA.RefreshLoop(loopCtx, []string{cid}, 24*time.Hour) // never ticks
		close(done)
	}()
	// Wait for the initial synchronous ProvideAll to finish.
	time.Sleep(300 * time.Millisecond)
	cancel()
	<-done

	findCtx, findCancel := context.WithTimeout(ctx, 3*time.Second)
	defer findCancel()
	providers, err := dhtB.FindProviders(findCtx, cid, 5)
	if err != nil {
		t.Fatalf("FindProviders: %v", err)
	}
	if len(providers) == 0 {
		t.Fatal("RefreshLoop did not provide the CID before ctx cancel")
	}
}

func TestRefreshLoopStopsOnContextCancel(t *testing.T) {
	dhtA, _, ctx := newPair(t)

	loopCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		dhtA.RefreshLoop(loopCtx, nil, 50*time.Millisecond)
		close(done)
	}()

	cancel()
	select {
	case <-done:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("RefreshLoop did not exit within 500ms of ctx cancel")
	}
}
