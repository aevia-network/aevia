package dht_test

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
)

// TestSessionAnnounceLoopLifecycle exercises the full lifecycle of
// the loop against a live 2-node pair. Guarantees:
//
//  1. First Provide is synchronous and emits Initial exactly once.
//  2. Periodic Provide fires on the configured interval.
//  3. Closing `done` stops the loop within one tick and emits Expired.
//  4. No Refresh fires after done is closed.
func TestSessionAnnounceLoopLifecycle(t *testing.T) {
	dhtA, _, ctx := newPair(t)
	cid := testCID(t, "sess-announce")

	var initial, refresh, expired atomic.Int64

	done := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		dhtA.SessionAnnounceLoop(ctx, done, cid, 80*time.Millisecond,
			func(ev aeviadht.SessionAnnounceEvent, _ error) {
				switch ev {
				case aeviadht.SessionAnnounceInitial:
					initial.Add(1)
				case aeviadht.SessionAnnounceRefresh:
					refresh.Add(1)
				case aeviadht.SessionAnnounceExpired:
					expired.Add(1)
				}
			},
		)
	}()

	time.Sleep(420 * time.Millisecond)
	gotRefresh := refresh.Load()
	if initial.Load() != 1 {
		t.Fatalf("initial=%d, want 1", initial.Load())
	}
	if gotRefresh < 3 {
		t.Fatalf("refresh=%d, want >=3 after 420ms at 80ms period", gotRefresh)
	}

	close(done)
	wg.Wait()

	if expired.Load() != 1 {
		t.Fatalf("expired=%d, want 1", expired.Load())
	}

	pre := refresh.Load()
	time.Sleep(250 * time.Millisecond)
	if post := refresh.Load(); post != pre {
		t.Fatalf("refresh leaked: %d → %d after done closed", pre, post)
	}
}

// TestSessionAnnounceLoopDefaultInterval verifies passing period=0
// picks up DefaultSessionReannouncePeriod without panicking. We can't
// wait 10 minutes in a test — we just prove the default branch compiles
// and an Initial Provide fires before cancellation.
func TestSessionAnnounceLoopDefaultInterval(t *testing.T) {
	dhtA, _, ctx := newPair(t)
	cid := testCID(t, "sess-default-interval")

	var initial atomic.Int64
	done := make(chan struct{})

	loopCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		dhtA.SessionAnnounceLoop(loopCtx, done, cid, 0, // default 10m
			func(ev aeviadht.SessionAnnounceEvent, _ error) {
				if ev == aeviadht.SessionAnnounceInitial {
					initial.Add(1)
				}
			},
		)
	}()

	time.Sleep(300 * time.Millisecond)
	cancel()
	wg.Wait()

	if initial.Load() != 1 {
		t.Fatalf("initial=%d, want 1 (default interval path)", initial.Load())
	}
}
