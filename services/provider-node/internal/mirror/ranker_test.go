package mirror_test

import (
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/mirror"
)

// TestRankerWorkedExample is the §5.4 scenario with γ=50 (the
// production-tuned default per spec §5.2.2). With γ=50 same-region
// always beats same-continent always beats cross-continent, regardless
// of load/rtt within the lower buckets. The worked-example TABLE in
// the spec §5.4 printed γ=1 score numbers (38/50/101/230) which is an
// inconsistency — the ORDER A,D,B,C below reflects the spec's stated
// design intent: "cross-continent is a last resort". Spec §5.4 will
// be patched in a follow-up PR to match; this test locks the runtime
// behaviour we actually want.
func TestRankerWorkedExample(t *testing.T) {
	r := mirror.NewRanker(mirror.DefaultWeights(), "BR-PB", -7.23, -35.88, true)
	cs := []mirror.Candidate{
		{PeerID: "A", Region: "BR-SP", RTTEMA: 18 * time.Millisecond, ActiveSessions: 2},
		{PeerID: "B", Region: "BR-RJ", RTTEMA: 25 * time.Millisecond, ActiveSessions: 0},
		{PeerID: "C", Region: "US-FL", RTTEMA: 120 * time.Millisecond, ActiveSessions: 1},
		{PeerID: "D", Region: "BR-SP", RTTEMA: 21 * time.Millisecond, ActiveSessions: 8},
	}
	scored := r.Rank(cs, mirror.ViewerHint{Region: "BR-SP"})
	// Expected scores (α=1, β=10, γ=50; viewer BR-SP):
	//   A: 18 + 2*10 + 50*0    = 38     same region → 0 penalty
	//   D: 21 + 8*10 + 50*0    = 101    same region → 0 penalty
	//   B: 25 + 0*10 + 50*25   = 1275   same continent → 25
	//   C: 120 + 1*10 + 50*100 = 5130   cross continent → 100
	wantOrder := []string{"A", "D", "B", "C"}
	for i, want := range wantOrder {
		if scored[i].PeerID != want {
			t.Fatalf("position %d: got %s want %s (scores=%v)", i, scored[i].PeerID, want, scoresOf(scored))
		}
	}
	wantScores := map[string]float64{"A": 38, "D": 101, "B": 1275, "C": 5130}
	for _, s := range scored {
		expected := wantScores[s.PeerID]
		if diff := s.Score - expected; diff > 1 || diff < -1 {
			t.Errorf("peer %s: score=%.1f want %.1f", s.PeerID, s.Score, expected)
		}
	}
}

// TestRankerHaversineBootstrap proves a cold-start candidate (no RTT
// yet) still gets a meaningful score via lat/lng → ms conversion. The
// closer-lat/lng candidate MUST outscore the farther one when both
// share region (same region_penalty = 0) and zero load.
func TestRankerHaversineBootstrap(t *testing.T) {
	r := mirror.NewRanker(mirror.DefaultWeights(), "BR-PB", -7.23, -35.88, true)
	// Both in BR-PB with no RTT yet; A is co-located, B is across the country.
	cs := []mirror.Candidate{
		{PeerID: "far", Region: "BR-SP", Lat: -23.55, Lng: -46.63, LatLngKnown: true},
		{PeerID: "near", Region: "BR-PB", Lat: -7.3, Lng: -35.9, LatLngKnown: true},
	}
	scored := r.Rank(cs, mirror.ViewerHint{Region: "BR-PB"})
	if scored[0].PeerID != "near" {
		t.Fatalf("near should outrank far, got order %s, %s", scored[0].PeerID, scored[1].PeerID)
	}
	if scored[0].RTTSource != "haversine-bootstrap" {
		t.Fatalf("expected haversine-bootstrap source, got %s", scored[0].RTTSource)
	}
}

// TestRankerStableTieBreakOnPeerID: equal scores → lower PeerID wins
// (spec §5.3). Ensures two origins never thrash.
func TestRankerStableTieBreakOnPeerID(t *testing.T) {
	r := mirror.NewRanker(mirror.DefaultWeights(), "US-VA", 0, 0, false)
	cs := []mirror.Candidate{
		{PeerID: "zebra", Region: "US-VA", RTTEMA: 10 * time.Millisecond},
		{PeerID: "alpha", Region: "US-VA", RTTEMA: 10 * time.Millisecond},
	}
	scored := r.Rank(cs, mirror.ViewerHint{Region: "US-VA"})
	if scored[0].PeerID != "alpha" {
		t.Fatalf("expected alpha to win byte-lex tie-break, got %s", scored[0].PeerID)
	}
}

// TestRankerCrossContinentEliminated: a super-fast cross-continent
// candidate still loses to a slower same-region one because of γ=50
// times the 100 penalty. Proves cross-continent is a last resort.
func TestRankerCrossContinentEliminated(t *testing.T) {
	r := mirror.NewRanker(mirror.DefaultWeights(), "BR-PB", 0, 0, false)
	cs := []mirror.Candidate{
		{PeerID: "fast-far", Region: "JP-13", RTTEMA: 1 * time.Millisecond}, // impossible but worst case
		{PeerID: "slow-near", Region: "BR-SP", RTTEMA: 999 * time.Millisecond},
	}
	// slow-near: 999 rtt + 0 load + 25*50 region (SA)? No — same continent == 25.
	// Wait actually: viewer BR-PB, cand BR-SP → same continent 25? No — both SA, same continent. Wait — region strings are EQUAL at country level (BR), so it's NOT exact region (BR-PB != BR-SP) but same continent → penalty 25.
	// Hmm actually: slow-near score = 999 + 0 + 25*25 = 999 + 625 = 1624? Ugh let me reconsider.
	// regionPenalty == 25 when continentOf(cand)==continentOf(viewer), so γ*25 = 1250.
	// slow-near: 999 + 0 + 50*25 = 999 + 1250 = 2249
	// fast-far: 1 + 0 + 50*100 = 1 + 5000 = 5001
	// So slow-near still wins. Good.
	scored := r.Rank(cs, mirror.ViewerHint{Region: "BR-PB"})
	if scored[0].PeerID != "slow-near" {
		t.Fatalf("same-continent should beat cross-continent, got %s", scored[0].PeerID)
	}
}

// TestRankerHandlesUnknownRegion: empty region strings get the
// 100-penalty, same as cross-continent. Keeps unknown providers
// at the back of the line, as intended.
func TestRankerHandlesUnknownRegion(t *testing.T) {
	r := mirror.NewRanker(mirror.DefaultWeights(), "", 0, 0, false)
	cs := []mirror.Candidate{
		{PeerID: "unknown", Region: "", RTTEMA: 10 * time.Millisecond},
		{PeerID: "known", Region: "BR-SP", RTTEMA: 20 * time.Millisecond},
	}
	scored := r.Rank(cs, mirror.ViewerHint{Region: "BR-SP"})
	if scored[0].PeerID != "known" {
		t.Fatalf("known region should beat unknown despite higher RTT, got %s", scored[0].PeerID)
	}
}

// TestContinentMapKnowsHomeCountries makes sure the countries Aevia's
// current mesh uses are in the continent map — else region_penalty
// silently treats them as cross-continent.
func TestContinentMapKnowsHomeCountries(t *testing.T) {
	// Uses internal Rank with pairs that would yield expected penalties
	// ONLY if the continent table entries exist. Tests behavioral contract.
	r := mirror.NewRanker(mirror.DefaultWeights(), "", 0, 0, false)

	// US ↔ CA, both NA — should score same-continent penalty (25*50 = 1250)
	cs := []mirror.Candidate{
		{PeerID: "ca", Region: "CA-ON", RTTEMA: 10 * time.Millisecond},
		{PeerID: "jp", Region: "JP-13", RTTEMA: 10 * time.Millisecond},
	}
	scored := r.Rank(cs, mirror.ViewerHint{Region: "US-VA"})
	// ca score = 10 + 1250 = 1260
	// jp score = 10 + 5000 = 5010
	if scored[0].PeerID != "ca" {
		t.Fatalf("CA should beat JP from US viewer, got %s (scores=%v)", scored[0].PeerID, scoresOf(scored))
	}
	// Expected delta ~3750
	if scored[1].Score-scored[0].Score < 3000 {
		t.Errorf("continent penalty delta too small: %v", scored[1].Score-scored[0].Score)
	}
}

func scoresOf(scored []mirror.ScoredCandidate) map[string]float64 {
	out := make(map[string]float64, len(scored))
	for _, s := range scored {
		out[s.PeerID] = s.Score
	}
	return out
}
