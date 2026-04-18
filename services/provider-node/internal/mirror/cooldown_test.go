package mirror_test

import (
	"testing"
	"time"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/peer"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/mirror"
)

// TestCooldownEnterAndObserve covers Fase 2.2d: a peer marked for
// cooldown reports IsInCooldown=true until the duration elapses.
func TestCooldownEnterAndObserve(t *testing.T) {
	c := newClientForTest(t)

	fakePeer := mustDecodePeer(t, "12D3KooWSvprtPXxXHEASpKux1vLyxWpBRYTps39GQrTEpccMjyh")

	if c.IsInCooldown(fakePeer) {
		t.Fatal("fresh peer should not be in cooldown")
	}

	c.EnterCooldown(fakePeer, 100*time.Millisecond)
	if !c.IsInCooldown(fakePeer) {
		t.Fatal("peer should be in cooldown immediately after EnterCooldown")
	}

	// Sleep past the cooldown window and verify automatic expiry.
	time.Sleep(150 * time.Millisecond)
	if c.IsInCooldown(fakePeer) {
		t.Fatal("cooldown should have expired")
	}
}

// TestCooldownDefaultDuration validates zero-duration EnterCooldown
// picks up DefaultCooldownDuration.
func TestCooldownDefaultDuration(t *testing.T) {
	c := newClientForTest(t)
	p := mustDecodePeer(t, "12D3KooWEs9TrvY9Bq59bqLAYxZ3yWJpw33CAggDJ6YpekNvQXSS")

	c.EnterCooldown(p, 0)
	snapshot := c.CooldownSnapshot()
	exp, ok := snapshot[p]
	if !ok {
		t.Fatal("peer missing from snapshot")
	}
	remaining := time.Until(exp)
	// DefaultCooldownDuration is 60s; we expect remaining > 55s immediately.
	if remaining < 55*time.Second {
		t.Fatalf("default cooldown shorter than expected: %v", remaining)
	}
}

// TestCooldownExtendsWhenLater — calling EnterCooldown with a longer
// duration extends the expiry; a shorter call is ignored.
func TestCooldownExtendsWhenLater(t *testing.T) {
	c := newClientForTest(t)
	p := mustDecodePeer(t, "12D3KooWDPfEhwDvJuhKG7r8DTqxtyQWaB7uJe9eJ1UcxcrJPi42")

	c.EnterCooldown(p, 100*time.Millisecond)
	c.EnterCooldown(p, 500*time.Millisecond) // extends
	c.EnterCooldown(p, 50*time.Millisecond)  // shorter, ignored

	snapshot := c.CooldownSnapshot()
	exp := snapshot[p]
	remaining := time.Until(exp)
	if remaining < 400*time.Millisecond {
		t.Fatalf("later EnterCooldown should extend, got %v", remaining)
	}
}

// TestSelectTopKFiltersCooldownedPeer covers the integration between
// RankerAdapter + cooldown: a peer in the static pool that's in
// cooldown MUST NOT appear in SelectTopK output.
func TestSelectTopKFiltersCooldownedPeer(t *testing.T) {
	c := newClientForTest(t)
	good := mustDecodePeer(t, "12D3KooWSvprtPXxXHEASpKux1vLyxWpBRYTps39GQrTEpccMjyh")
	bad := mustDecodePeer(t, "12D3KooWEs9TrvY9Bq59bqLAYxZ3yWJpw33CAggDJ6YpekNvQXSS")

	c.EnterCooldown(bad, 10*time.Second)

	ranker := mirror.NewRanker(mirror.DefaultWeights(), "US-VA", 39.12, -77.56, true)
	adapter := mirror.NewRankerAdapter(mirror.RankerAdapterConfig{
		Client: c,
		Ranker: ranker,
		StaticPool: []mirror.Candidate{
			{PeerID: good.String(), Region: "US-VA", RTTEMA: 20 * time.Millisecond},
			{PeerID: bad.String(), Region: "US-VA", RTTEMA: 10 * time.Millisecond},
		},
	})

	picked := adapter.SelectTopK(t.Context(), mirror.ViewerHint{Region: "US-VA"}, 3)
	if len(picked) != 1 {
		t.Fatalf("expected exactly 1 peer picked (bad is cooldowned), got %d: %v", len(picked), picked)
	}
	if picked[0] != good {
		t.Fatalf("expected 'good' picked, got %s", picked[0].String())
	}
}

func newClientForTest(t *testing.T) *mirror.Client {
	t.Helper()
	h, err := libp2p.New(
		libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"),
		libp2p.DisableRelay(),
	)
	if err != nil {
		t.Fatalf("libp2p.New: %v", err)
	}
	t.Cleanup(func() { _ = h.Close() })
	client, err := mirror.NewClient(h, nil, nil, mirror.ClientOptions{})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return client
}

func mustDecodePeer(t *testing.T, s string) peer.ID {
	t.Helper()
	p, err := peer.Decode(s)
	if err != nil {
		t.Fatalf("peer.Decode(%q): %v", s, err)
	}
	return p
}
