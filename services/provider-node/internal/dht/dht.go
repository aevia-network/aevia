// Package dht wraps go-libp2p-kad-dht for the Aevia network.
//
// The Kademlia DHT is the decentralised discovery substrate that turns a
// CID into a list of Provider Nodes serving it. No central registry.
// Every Provider Node acts as both a DHT server (answers queries) and a
// provider (announces the CIDs it pins). Viewer clients can run in
// CLIENT_ONLY mode, consuming lookups without participating in routing.
//
// Protocol prefix /aevia/kad/1.0.0 namespaces our DHT from public IPFS —
// Aevia nodes never accidentally peer with the IPFS public DHT, and vice
// versa. This is the same pattern Filecoin, FlashTest, and many Kad forks
// use.
package dht

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/ipfs/go-cid"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"

	dht "github.com/libp2p/go-libp2p-kad-dht"
)

// peerstoreTTL is how long we keep addresses surfaced by FindProviders.
// 10 minutes is long enough for the caller to dial but short enough that
// stale entries don't linger forever.
const peerstoreTTL = 10 * time.Minute

// ProtocolPrefix is the Aevia DHT namespace. All protocol IDs emitted by
// this DHT are rooted under /aevia/kad/1.0.0.
const ProtocolPrefix = "/aevia"

// Mode selects how the DHT participates in the network.
type Mode int

const (
	// ModeServer responds to queries, provides records, and routes.
	// Provider Nodes and Relay Nodes use this mode.
	ModeServer Mode = iota
	// ModeClient only consumes — queries and receives records but does
	// not route or respond. Viewer clients use this mode.
	ModeClient
	// ModeAuto lets the DHT decide based on AutoNAT (reachable → server,
	// behind NAT → client). Matches kad-dht's default.
	ModeAuto
)

// DHT is the Aevia wrapper around *dht.IpfsDHT.
type DHT struct {
	host host.Host
	ipfs *dht.IpfsDHT
	mode Mode
}

// New builds a DHT instance bound to h. Call Bootstrap afterwards to connect
// to seed peers.
func New(ctx context.Context, h host.Host, mode Mode) (*DHT, error) {
	if h == nil {
		return nil, errors.New("dht: host is required")
	}

	opts := []dht.Option{
		dht.ProtocolPrefix(ProtocolPrefix),
		dht.Mode(toKadMode(mode)),
	}

	kad, err := dht.New(ctx, h, opts...)
	if err != nil {
		return nil, fmt.Errorf("dht: construct: %w", err)
	}
	return &DHT{host: h, ipfs: kad, mode: mode}, nil
}

// Bootstrap connects to the given seed peers and kicks the Kademlia routing
// table. Returns nil if at least one seed connects; otherwise the last
// error from the attempted connections.
func (d *DHT) Bootstrap(ctx context.Context, seeds []peer.AddrInfo) error {
	if d.ipfs == nil {
		return errors.New("dht: not initialized")
	}
	var lastErr error
	connected := 0
	for _, seed := range seeds {
		if err := d.host.Connect(ctx, seed); err != nil {
			lastErr = fmt.Errorf("dht: connect %s: %w", seed.ID, err)
			continue
		}
		connected++
	}
	if connected == 0 && len(seeds) > 0 {
		return lastErr
	}
	return d.ipfs.Bootstrap(ctx)
}

// Inner exposes the underlying kad-dht for advanced operations (provide,
// find-providers). Higher levels of the stack should prefer the typed
// helpers in this package.
func (d *DHT) Inner() *dht.IpfsDHT { return d.ipfs }

// Host returns the libp2p host this DHT is bound to.
func (d *DHT) Host() host.Host { return d.host }

// Mode returns the configured participation mode.
func (d *DHT) Mode() Mode { return d.mode }

// Close stops the underlying DHT and releases its datastore.
func (d *DHT) Close() error {
	if d.ipfs == nil {
		return nil
	}
	return d.ipfs.Close()
}

// Provide announces to the DHT that this node serves the content identified
// by cidStr. brdcst=true instructs kad-dht to propagate the provider record
// to the closest peers to the CID key — the canonical behavior.
func (d *DHT) Provide(ctx context.Context, cidStr string) error {
	if d.ipfs == nil {
		return errors.New("dht: not initialized")
	}
	c, err := cid.Parse(cidStr)
	if err != nil {
		return fmt.Errorf("dht: parse cid %q: %w", cidStr, err)
	}
	if err := d.ipfs.Provide(ctx, c, true); err != nil {
		return fmt.Errorf("dht: provide %s: %w", cidStr, err)
	}
	return nil
}

// DefaultProviderLimit is the maximum provider records returned when the
// caller passes 0 to FindProviders.
const DefaultProviderLimit = 20

// DefaultRefreshPeriod is how often RefreshLoop re-announces provider
// records. kad-dht's default provider record expiry is 24h, so we refresh
// every 6h to give 4 retries before a record would disappear.
const DefaultRefreshPeriod = 6 * time.Hour

// DefaultSessionReannouncePeriod is how often a live-session re-announces
// its sessionCID while the origin (or mirror) is alive. 10 minutes is
// deliberately shorter than DefaultRefreshPeriod for pinned content:
// live-session records MUST evaporate quickly when the origin dies so
// viewers don't waste dial budget on stale peers. The provider record's
// ~24h TTL means that with a 10-minute refresh, after origin death the
// record survives roughly 20 minutes (one missed refresh + the natural
// TTL that hasn't been renewed). Kad-dht internally expires based on
// `provide_validity`; the 10-minute pace is the external guarantee.
const DefaultSessionReannouncePeriod = 10 * time.Minute

// ProvideAll announces every CID in cids. Returns the first error if any;
// subsequent CIDs are still attempted so a single bad entry doesn't block
// the rest.
func (d *DHT) ProvideAll(ctx context.Context, cids []string) error {
	var firstErr error
	for _, c := range cids {
		if err := d.Provide(ctx, c); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// RefreshLoop provides cids immediately and then re-provides them every
// period until ctx is cancelled. Intended to run as a goroutine from main.
// Passing period <= 0 uses DefaultRefreshPeriod.
func (d *DHT) RefreshLoop(ctx context.Context, cids []string, period time.Duration) {
	if period <= 0 {
		period = DefaultRefreshPeriod
	}
	_ = d.ProvideAll(ctx, cids)
	ticker := time.NewTicker(period)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = d.ProvideAll(ctx, cids)
		}
	}
}

// SessionAnnounceEvent identifies a lifecycle moment in a session's
// DHT announcement loop — used by callers that want structured logs
// without reaching into the DHT internals.
type SessionAnnounceEvent int

const (
	// SessionAnnounceInitial fires on the first successful Provide call
	// at session start. Callers emit the "session_announced" log event.
	SessionAnnounceInitial SessionAnnounceEvent = iota
	// SessionAnnounceRefresh fires on every periodic re-Provide while
	// the session is alive. Maps to "session_announce_refresh".
	SessionAnnounceRefresh
	// SessionAnnounceFailed fires when a Provide call returns an error.
	// Loop keeps running; a transient DHT hiccup shouldn't kill the
	// announcement cadence. Maps to "session_announce_failed".
	SessionAnnounceFailed
	// SessionAnnounceExpired fires exactly once when the loop exits
	// (session closed, context cancelled). After this no more
	// re-announcements happen for this CID and the kad-dht TTL takes
	// over. Maps to "session_announce_expired".
	SessionAnnounceExpired
)

// SessionAnnounceLoop announces cidStr into the DHT at session start
// and re-announces every period while `done` is still open. Returns
// immediately after `done` closes (session ended) or ctx cancels.
//
// The loop spawns one goroutine per session and is the canonical entry
// point for both origin WHIP sessions (main.go whipSrv.OnSession) and
// mirror sessions (main.go mirrorSrv.OnSession).
//
// Passing period <= 0 uses DefaultSessionReannouncePeriod.
// cb is optional — receives every lifecycle event. Errors from cb are
// ignored (callback should swallow its own failures).
func (d *DHT) SessionAnnounceLoop(
	ctx context.Context,
	done <-chan struct{},
	cidStr string,
	period time.Duration,
	cb func(event SessionAnnounceEvent, err error),
) {
	if period <= 0 {
		period = DefaultSessionReannouncePeriod
	}
	// Initial synchronous announce so the first viewer resolving the
	// sessionCID sees us without waiting one period. Failure is logged
	// by cb but does NOT abort — the periodic loop keeps retrying.
	initialCtx, initialCancel := context.WithTimeout(ctx, 30*time.Second)
	err := d.Provide(initialCtx, cidStr)
	initialCancel()
	if cb != nil {
		if err != nil {
			cb(SessionAnnounceFailed, err)
		} else {
			cb(SessionAnnounceInitial, nil)
		}
	}

	defer func() {
		if cb != nil {
			cb(SessionAnnounceExpired, nil)
		}
	}()

	ticker := time.NewTicker(period)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-done:
			return
		case <-ticker.C:
			reCtx, reCancel := context.WithTimeout(ctx, 30*time.Second)
			err := d.Provide(reCtx, cidStr)
			reCancel()
			if cb != nil {
				if err != nil {
					cb(SessionAnnounceFailed, err)
				} else {
					cb(SessionAnnounceRefresh, nil)
				}
			}
		}
	}
}

// FindProviders queries the DHT for providers of cidStr. Returns up to
// `limit` PeerIDs ranked by Kademlia distance (the DHT's natural order).
// Passing limit <= 0 uses DefaultProviderLimit.
func (d *DHT) FindProviders(ctx context.Context, cidStr string, limit int) ([]peer.ID, error) {
	if d.ipfs == nil {
		return nil, errors.New("dht: not initialized")
	}
	c, err := cid.Parse(cidStr)
	if err != nil {
		return nil, fmt.Errorf("dht: parse cid %q: %w", cidStr, err)
	}
	if limit <= 0 {
		limit = DefaultProviderLimit
	}

	ch := d.ipfs.FindProvidersAsync(ctx, c, limit)
	out := make([]peer.ID, 0, limit)
	for info := range ch {
		out = append(out, info.ID)
		// Also absorb any addresses the query surfaced so later dials
		// don't need to re-resolve via the DHT.
		if len(info.Addrs) > 0 {
			d.host.Peerstore().AddAddrs(info.ID, info.Addrs, peerstoreTTL)
		}
	}
	return out, nil
}

func toKadMode(m Mode) dht.ModeOpt {
	switch m {
	case ModeServer:
		return dht.ModeServer
	case ModeClient:
		return dht.ModeClient
	default:
		return dht.ModeAuto
	}
}
