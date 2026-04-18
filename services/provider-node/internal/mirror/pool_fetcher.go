package mirror

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/protocol"

	p2phttp "github.com/libp2p/go-libp2p-http"
)

// DefaultAeviaHTTPProtocol matches httpx.DefaultProtocol so PoolFetcher
// hits /healthz over the same libp2p HTTP transport the internal
// `client` package already uses.
const DefaultAeviaHTTPProtocol protocol.ID = "/aevia/http/1.0.0"

// healthzWire is the subset of httpx.healthResponse fields PoolFetcher
// needs. Lives here (not imported from httpx) to keep the mirror
// package free of httpx dependency.
type healthzWire struct {
	PeerID         string   `json:"peer_id"`
	Region         string   `json:"region,omitempty"`
	Lat            *float64 `json:"lat,omitempty"`
	Lng            *float64 `json:"lng,omitempty"`
	ActiveSessions *int     `json:"active_sessions,omitempty"`
}

// PoolFetcher queries /healthz over libp2p for every peer we believe
// might serve as a mirror, with a short TTL cache so successive
// /mirrors/candidates calls don't hammer every peer.
//
// Two pool sources are merged:
//  1. `host.Network().Peers()` — any peer libp2p has an active
//     connection to right now. This is the "free" pool — zero dial
//     cost, and it includes bootstrap peers which are likely our
//     peer mirrors anyway.
//  2. Extra peer IDs supplied at construction (static override,
//     typically the parsed AEVIA_MIRROR_PEERS). Included even when
//     not yet connected so the first-boot candidate set isn't empty.
//
// Self is filtered out — you can't mirror to yourself.
type PoolFetcher struct {
	host       host.Host
	http       *http.Client
	staticSeed []peer.ID
	ttl        time.Duration
	timeout    time.Duration

	mu    sync.Mutex
	cache map[peer.ID]cachedPeer
}

type cachedPeer struct {
	candidate Candidate
	at        time.Time
	ok        bool
}

// PoolFetcherConfig is the wiring for NewPoolFetcher.
type PoolFetcherConfig struct {
	Host       host.Host
	StaticSeed []peer.ID
	// TTL is how long a healthz response is trusted before re-probing.
	// Zero defaults to 60s. Too short = wasted peer bandwidth; too long
	// = candidate ranker uses stale region/load data.
	TTL time.Duration
	// Timeout bounds each per-peer /healthz request. Zero defaults to
	// 2s — matches the edge-side Pages fetchMeshHealth default.
	Timeout time.Duration
}

// NewPoolFetcher builds a fetcher using p2phttp as the underlying
// transport — same protocol the internal `client` package uses so
// there's no additional listener on the target peer.
func NewPoolFetcher(cfg PoolFetcherConfig) *PoolFetcher {
	ttl := cfg.TTL
	if ttl == 0 {
		ttl = 60 * time.Second
	}
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 2 * time.Second
	}
	return &PoolFetcher{
		host: cfg.Host,
		http: &http.Client{
			Transport: p2phttp.NewTransport(cfg.Host, p2phttp.ProtocolOption(DefaultAeviaHTTPProtocol)),
			Timeout:   timeout,
		},
		staticSeed: cfg.StaticSeed,
		ttl:        ttl,
		timeout:    timeout,
		cache:      make(map[peer.ID]cachedPeer),
	}
}

// Fetch returns the current candidate pool. Called synchronously by
// RankerAdapter on each /mirrors/candidates or SelectMirrors request.
// Cache lookups are the fast path; a cache miss spawns per-peer
// probes in parallel bounded by the fetcher's overall context.
//
// Unreachable peers are NOT dropped from the pool — they come back
// as a Candidate with RTTEMA=0 and Region="" so the ranker can still
// place them in the cold-start / unknown tier. The return order is
// insertion-stable so ties break consistently.
func (p *PoolFetcher) Fetch(ctx context.Context) []Candidate {
	self := p.host.ID()
	// Deduplicate source peers: live connections + static seeds.
	seen := make(map[peer.ID]struct{})
	list := make([]peer.ID, 0, 8)
	for _, pid := range p.host.Network().Peers() {
		if pid == self {
			continue
		}
		if _, ok := seen[pid]; ok {
			continue
		}
		seen[pid] = struct{}{}
		list = append(list, pid)
	}
	for _, pid := range p.staticSeed {
		if pid == self {
			continue
		}
		if _, ok := seen[pid]; ok {
			continue
		}
		seen[pid] = struct{}{}
		list = append(list, pid)
	}

	// Split list into hot cache hits + peers needing a fresh probe.
	// Probes fire in parallel; cache hits are returned immediately.
	p.mu.Lock()
	now := time.Now()
	fresh := make([]Candidate, 0, len(list))
	misses := make([]peer.ID, 0)
	for _, pid := range list {
		if entry, ok := p.cache[pid]; ok && now.Sub(entry.at) < p.ttl {
			fresh = append(fresh, entry.candidate)
			continue
		}
		misses = append(misses, pid)
	}
	p.mu.Unlock()

	if len(misses) > 0 {
		results := p.probeParallel(ctx, misses)
		p.mu.Lock()
		for pid, c := range results {
			p.cache[pid] = cachedPeer{candidate: c.candidate, at: now, ok: c.ok}
			fresh = append(fresh, c.candidate)
		}
		p.mu.Unlock()
	}
	return fresh
}

// probeParallel fans out /healthz to every peer in ids and returns
// the map of (pid → probeResult). Unreachable peers come back with
// ok=false and an empty-ish Candidate (PeerID only).
func (p *PoolFetcher) probeParallel(ctx context.Context, ids []peer.ID) map[peer.ID]probeResult {
	out := make(map[peer.ID]probeResult, len(ids))
	mu := sync.Mutex{}
	var wg sync.WaitGroup
	for _, pid := range ids {
		wg.Add(1)
		go func(pid peer.ID) {
			defer wg.Done()
			c, ok := p.probeOne(ctx, pid)
			mu.Lock()
			out[pid] = probeResult{candidate: c, ok: ok}
			mu.Unlock()
		}(pid)
	}
	wg.Wait()
	return out
}

type probeResult struct {
	candidate Candidate
	ok        bool
}

// probeOne hits GET /healthz on the given peer over libp2p HTTP,
// parses the JSON into a Candidate, and returns it. On any failure
// (connection refused, timeout, bad JSON) it returns a Candidate with
// just PeerID populated and ok=false — the ranker's cold-start
// path handles it from there.
func (p *PoolFetcher) probeOne(ctx context.Context, pid peer.ID) (Candidate, bool) {
	reqCtx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()
	url := fmt.Sprintf("libp2p://%s/healthz", pid.String())
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, url, nil)
	if err != nil {
		return Candidate{PeerID: pid.String()}, false
	}
	resp, err := p.http.Do(req)
	if err != nil {
		return Candidate{PeerID: pid.String()}, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Candidate{PeerID: pid.String()}, false
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return Candidate{PeerID: pid.String()}, false
	}
	var h healthzWire
	if err := json.Unmarshal(body, &h); err != nil {
		return Candidate{PeerID: pid.String()}, false
	}
	c := Candidate{
		PeerID: pid.String(),
		Region: h.Region,
	}
	if h.Lat != nil && h.Lng != nil {
		c.Lat = *h.Lat
		c.Lng = *h.Lng
		c.LatLngKnown = true
	}
	if h.ActiveSessions != nil {
		c.ActiveSessions = *h.ActiveSessions
	}
	return c, true
}

// AsPoolFunc adapts the fetcher to the RankerAdapterConfig.PoolFetcher
// shape (non-context variant). Uses context.Background since the
// HTTP client already has its own timeout; callers that need
// cancellation should use Fetch directly.
func (p *PoolFetcher) AsPoolFunc() func() []Candidate {
	return func() []Candidate {
		return p.Fetch(context.Background())
	}
}
