package mirror

import (
	"context"
	"time"

	"github.com/libp2p/go-libp2p/core/peer"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// RankerAdapter plumbs a mirror.Ranker + Client snapshot into the
// httpx.MirrorRanker interface. Main.go constructs it once at boot
// and hands it to httpx.NewServer via httpx.WithMirrorRanker.
//
// The adapter owns NO state of its own — the pool comes from the
// Client (peerMetrics persistent map + supplied static peers) and
// the scoring comes from the Ranker. Separation keeps both testable
// in isolation and keeps httpx.Server import-free of mirror.
type RankerAdapter struct {
	client *Client
	ranker *Ranker
	// static enriches the dynamic pool with operator-declared peers
	// (from AEVIA_MIRROR_PEERS + any sidecar registry). Region/geo
	// come from a supplied resolver since peer.ID alone doesn't tell
	// you where the peer lives — main.go wires this to a callback
	// that hits /healthz of each peer (cached ~60s TTL).
	staticPool  []Candidate
	poolFetcher func() []Candidate
}

// RankerAdapterConfig wires the three inputs.
type RankerAdapterConfig struct {
	// Client is the mirror client whose peerMetrics drive RTT+loss.
	Client *Client
	// Ranker does the scoring. Pass NewRanker(DefaultWeights(), ...).
	Ranker *Ranker
	// StaticPool is the operator-declared seed set. Typically
	// derived from AEVIA_MIRROR_PEERS. May be nil.
	StaticPool []Candidate
	// PoolFetcher — optional callback that returns the *current* pool
	// at request time. Nil means "pool == StaticPool forever". In prod
	// main.go wires this to a resolver that queries /healthz for
	// active_sessions + region on a per-peer basis with a TTL cache.
	PoolFetcher func() []Candidate
}

// NewRankerAdapter builds the adapter. Fails if required deps are nil.
func NewRankerAdapter(cfg RankerAdapterConfig) *RankerAdapter {
	return &RankerAdapter{
		client:      cfg.Client,
		ranker:      cfg.Ranker,
		staticPool:  cfg.StaticPool,
		poolFetcher: cfg.PoolFetcher,
	}
}

// CandidateSnapshot implements httpx.MirrorRanker. It merges the
// static pool with any dynamic pool from the fetcher, annotating each
// peer with the live RTT EMA from the Client's peerMetrics map.
//
// Duplicates (same PeerID in both pools) are collapsed — the dynamic
// entry wins because it likely has fresher region/geo/load data.
func (a *RankerAdapter) CandidateSnapshot() []httpx.MirrorCandidate {
	byID := make(map[string]Candidate)
	for _, c := range a.staticPool {
		byID[c.PeerID] = c
	}
	if a.poolFetcher != nil {
		for _, c := range a.poolFetcher() {
			byID[c.PeerID] = c
		}
	}

	// Enrich with live RTT from Client.peerMetrics. We iterate the
	// snapshot so we don't hold the client lock while building the list.
	if a.client != nil {
		snapshot := a.client.PeerMetricsSnapshot()
		for peerID, m := range snapshot {
			pid := peerID.String()
			c := byID[pid]
			c.PeerID = pid
			c.RTTEMA = m.EchoEMA()
			if m.ProbeCount() > 0 {
				totalLoss := float64(m.ProbeLoss())
				total := float64(m.ProbeCount()) + totalLoss
				if total > 0 {
					c.ProbeLossPct = (totalLoss / total) * 100.0
				}
			}
			byID[pid] = c
		}
	}

	// Fase 2.2e — tag cooldowned peers for /mirrors/candidates
	// observability. Hot-path SelectTopK filters these out separately.
	out := make([]httpx.MirrorCandidate, 0, len(byID))
	for pidStr, c := range byID {
		if a.client != nil {
			if pid, err := peer.Decode(pidStr); err == nil {
				c.InCooldown = a.client.IsInCooldown(pid)
			}
		}
		out = append(out, candidateToHTTPX(c))
	}
	return out
}

// Score implements httpx.MirrorRanker by running mirror.Ranker.Rank.
func (a *RankerAdapter) Score(candidates []httpx.MirrorCandidate, viewerRegion string) []httpx.ScoredMirrorCandidate {
	internal := make([]Candidate, 0, len(candidates))
	for _, c := range candidates {
		internal = append(internal, candidateFromHTTPX(c))
	}
	scored := a.ranker.Rank(internal, ViewerHint{Region: viewerRegion})
	out := make([]httpx.ScoredMirrorCandidate, 0, len(scored))
	for _, s := range scored {
		out = append(out, httpx.ScoredMirrorCandidate{
			MirrorCandidate: candidateToHTTPX(s.Candidate),
			Score:           s.Score,
			RTTTerm:         s.RTTTerm,
			LoadTerm:        s.LoadTerm,
			RegionTerm:      s.RegionTerm,
			RTTSource:       s.RTTSource,
		})
	}
	return out
}

func candidateToHTTPX(c Candidate) httpx.MirrorCandidate {
	return httpx.MirrorCandidate{
		PeerID:         c.PeerID,
		HTTPSBase:      c.HTTPSBase,
		Region:         c.Region,
		Lat:            c.Lat,
		Lng:            c.Lng,
		LatLngKnown:    c.LatLngKnown,
		RTTEMAMs:       float64(c.RTTEMA.Milliseconds()),
		ActiveSessions: c.ActiveSessions,
		ProbeLossPct:   c.ProbeLossPct,
		InCooldown:     c.InCooldown,
		BootstrapRTTMs: float64(c.BootstrapRTT.Milliseconds()),
	}
}

func candidateFromHTTPX(c httpx.MirrorCandidate) Candidate {
	return Candidate{
		PeerID:         c.PeerID,
		HTTPSBase:      c.HTTPSBase,
		Region:         c.Region,
		Lat:            c.Lat,
		Lng:            c.Lng,
		LatLngKnown:    c.LatLngKnown,
		RTTEMA:         timeDurationFromMs(c.RTTEMAMs),
		ActiveSessions: c.ActiveSessions,
		ProbeLossPct:   c.ProbeLossPct,
		InCooldown:     c.InCooldown,
		BootstrapRTT:   timeDurationFromMs(c.BootstrapRTTMs),
	}
}

func timeDurationFromMs(ms float64) time.Duration {
	return time.Duration(ms * float64(time.Millisecond))
}

// SelectTopK implements DynamicSelector — returns the top-K peer IDs
// ranked by the same score formula /mirrors/candidates exposes.
// Called by main.go's OnSession when AEVIA_MIRROR_PEERS is empty, so
// the origin picks mirrors based on live RTT + region + load instead
// of an operator-hardcoded CSV.
//
// Returns nil when the pool is empty (no libp2p peers, no static seed,
// PoolFetcher returned nothing). Caller should fall back to static
// peers or accept single-origin mode.
func (a *RankerAdapter) SelectTopK(_ context.Context, hint ViewerHint, k int) []peer.ID {
	if k <= 0 {
		k = 3
	}
	httpxCands := a.CandidateSnapshot()
	if len(httpxCands) == 0 {
		return nil
	}
	// Fase 2.2d — drop cooldowned peers BEFORE scoring so a bad mirror
	// doesn't keep reappearing in /mirrors/candidates during its
	// cooldown window, and the ranker doesn't keep re-proposing it.
	if a.client != nil {
		filtered := httpxCands[:0]
		for _, c := range httpxCands {
			pid, err := peer.Decode(c.PeerID)
			if err == nil && a.client.IsInCooldown(pid) {
				continue
			}
			filtered = append(filtered, c)
		}
		httpxCands = filtered
	}
	scored := a.Score(httpxCands, hint.Region)
	if len(scored) > k {
		scored = scored[:k]
	}
	out := make([]peer.ID, 0, len(scored))
	for _, sc := range scored {
		pid, err := peer.Decode(sc.PeerID)
		if err != nil {
			continue
		}
		out = append(out, pid)
	}
	return out
}
