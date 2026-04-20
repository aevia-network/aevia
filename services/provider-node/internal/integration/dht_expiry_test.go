package integration_test

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	libp2p "github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/peer"

	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
)

// TestDHTSessionAnnounceLoopReannounces covers the Task-2 contract:
// a live-session loop initially announces, periodically re-announces
// while `done` is open, and stops re-announcing when `done` closes.
// The callback is the canonical observation point — it emits one
// Initial, N Refresh, and exactly one Expired event.
//
// Runs against a 2-node DHT pair (newPair helper from provide_test.go)
// so Provide has a non-empty routing table. Uses a 100ms re-announce
// interval so the test finishes in under a second.
func TestDHTSessionAnnounceLoopReannounces(t *testing.T) {
	dhtA, _, ctx := newPair(t)
	cid := dhtTestCID(t, "session-announce-loop")

	var (
		initial atomic.Int64
		refresh atomic.Int64
		failed  atomic.Int64
		expired atomic.Int64
	)

	done := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		dhtA.SessionAnnounceLoop(ctx, done, cid, 100*time.Millisecond,
			func(ev aeviadht.SessionAnnounceEvent, err error) {
				switch ev {
				case aeviadht.SessionAnnounceInitial:
					initial.Add(1)
				case aeviadht.SessionAnnounceRefresh:
					refresh.Add(1)
				case aeviadht.SessionAnnounceFailed:
					failed.Add(1)
				case aeviadht.SessionAnnounceExpired:
					expired.Add(1)
				}
			},
		)
	}()

	// Let the loop run for ~550ms so we expect 1 Initial + ~5 Refresh.
	// The initial Provide is synchronous, but we give the goroutine time
	// to schedule before we measure.
	time.Sleep(550 * time.Millisecond)

	initialNow := initial.Load()
	refreshNow := refresh.Load()
	if initialNow != 1 {
		t.Fatalf("initial=%d, want exactly 1", initialNow)
	}
	if refreshNow < 3 {
		t.Fatalf("refresh=%d after 550ms, want >=3 (period=100ms)", refreshNow)
	}

	// Close `done` — loop should exit promptly.
	close(done)
	// Wait for the goroutine to finish. Longer than one period so we
	// can also assert no additional Refresh fires after close.
	stoppedAt := time.Now()
	wg.Wait()
	if elapsed := time.Since(stoppedAt); elapsed > 500*time.Millisecond {
		t.Fatalf("loop took %v to stop after done closed, want <500ms", elapsed)
	}

	if expired.Load() != 1 {
		t.Fatalf("expired=%d after stop, want exactly 1", expired.Load())
	}

	// Verify no further refresh fires after we observed the stop. Wait
	// 300ms (3 periods) and snapshot — count must be identical to
	// refreshNow (the value at stop time, not the current one since
	// there's a narrow window where the final tick races with done).
	finalRefresh := refresh.Load()
	time.Sleep(300 * time.Millisecond)
	if postStop := refresh.Load(); postStop != finalRefresh {
		t.Fatalf("refresh jumped from %d to %d after done closed — loop leaked",
			finalRefresh, postStop)
	}

	// Failed count can be > 0 if kad-dht has a transient issue, but
	// against a live peer we expect zero. Log diagnostic rather than
	// fail since we can't control external DHT conditions in CI.
	if f := failed.Load(); f > 0 {
		t.Logf("session announce saw %d transient Failed events (non-fatal)", f)
	}
}

// TestDHTSessionAnnounceLoopStopsOnContextCancel verifies the ctx
// cancellation path — symmetric to the done-channel path but with the
// other exit condition. Important because in main.go the parent ctx
// cancels on SIGINT/SIGTERM; the loop must NOT leak past shutdown.
func TestDHTSessionAnnounceLoopStopsOnContextCancel(t *testing.T) {
	dhtA, _, ctx := newPair(t)
	cid := dhtTestCID(t, "session-announce-ctx-cancel")

	loopCtx, cancelLoop := context.WithCancel(ctx)
	defer cancelLoop()

	var expired atomic.Int64
	done := make(chan struct{})
	defer close(done)

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		dhtA.SessionAnnounceLoop(loopCtx, done, cid, 50*time.Millisecond,
			func(ev aeviadht.SessionAnnounceEvent, _ error) {
				if ev == aeviadht.SessionAnnounceExpired {
					expired.Add(1)
				}
			},
		)
	}()

	time.Sleep(200 * time.Millisecond)
	cancelLoop()

	doneCh := make(chan struct{})
	go func() { wg.Wait(); close(doneCh) }()
	select {
	case <-doneCh:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("SessionAnnounceLoop did not exit within 500ms of ctx cancel")
	}
	if expired.Load() != 1 {
		t.Fatalf("expired=%d after cancel, want 1", expired.Load())
	}
}

// newPair builds two Aevia DHT nodes on loopback and cross-bootstraps
// them so Provide has a non-empty routing table. dhtTestCID (from
// dht_killswitch_test.go) produces a valid CIDv1 raw for the announce
// target.
func newPair(t *testing.T) (*aeviadht.DHT, *aeviadht.DHT, context.Context) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)

	hostA, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"), libp2p.DisableRelay())
	if err != nil {
		t.Fatalf("host A: %v", err)
	}
	t.Cleanup(func() { _ = hostA.Close() })
	hostB, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"), libp2p.DisableRelay())
	if err != nil {
		t.Fatalf("host B: %v", err)
	}
	t.Cleanup(func() { _ = hostB.Close() })

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

	if err := dhtA.Bootstrap(ctx, []peer.AddrInfo{{ID: hostB.ID(), Addrs: hostB.Addrs()}}); err != nil {
		t.Fatalf("bootstrap A: %v", err)
	}
	if err := dhtB.Bootstrap(ctx, []peer.AddrInfo{{ID: hostA.ID(), Addrs: hostA.Addrs()}}); err != nil {
		t.Fatalf("bootstrap B: %v", err)
	}
	time.Sleep(200 * time.Millisecond)

	return dhtA, dhtB, ctx
}
