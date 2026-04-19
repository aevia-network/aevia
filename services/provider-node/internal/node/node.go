// Package node wires the libp2p host lifecycle for a Provider Node.
package node

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/p2p/host/autorelay"
	relayv2 "github.com/libp2p/go-libp2p/p2p/protocol/circuitv2/relay"
)

// Config groups the knobs required to boot a Node.
type Config struct {
	PrivKey     crypto.PrivKey
	ListenAddrs []string

	// DisableRelay opts out of the default Circuit Relay v2 client entirely.
	// Mostly for tests that want a minimal host.
	DisableRelay bool

	// EnableRelayService turns this node into a Circuit Relay v2 HOP host.
	// Relay Nodes (operated by Aevia infra) set this to true. Provider Nodes
	// and Viewer clients MUST leave it false.
	EnableRelayService bool

	// StaticRelays are the addresses this node should reserve circuit slots
	// on (when it detects it is behind NAT / has no public reachability).
	// Empty disables AutoRelay.
	StaticRelays []peer.AddrInfo

	// EnableNATService advertises an AutoNAT service to peers. Relay Nodes
	// set this so clients can learn their reachability status.
	EnableNATService bool

	// ForceReachability overrides automatic reachability detection. Used in
	// tests (where 127.0.0.1 is never considered reachable) and by operators
	// who know their network posture a priori. Valid values: "", "public",
	// "private". Empty string keeps the automatic detection.
	ForceReachability string

	// DisableMetrics is reserved for future Prometheus integration.
	DisableMetrics bool

	// WebSocketListen (Fase 3.1) enables a WebSocket listener so
	// browsers running js-libp2p can dial this node directly.
	// Example: "/ip4/127.0.0.1/tcp/4002/ws" behind a reverse proxy
	// that terminates TLS and routes /libp2p/* WebSocket upgrades.
	// Empty disables the WS transport — viewers keep using WHEP +
	// DHT resolve only (no P2P mesh layer).
	WebSocketListen string
}

// Node owns a libp2p host and exposes lifecycle helpers.
type Node struct {
	host host.Host
}

// New builds a libp2p host from cfg but does NOT start any application
// services on top of it. That is deliberate — later milestones add the HTTP
// mux, DHT, and pinning storage as independent modules.
func New(cfg Config) (*Node, error) {
	if cfg.PrivKey == nil {
		return nil, errors.New("node: PrivKey is required")
	}

	addrs := cfg.ListenAddrs
	if len(addrs) == 0 {
		addrs = []string{"/ip4/0.0.0.0/tcp/0"}
	}
	// Fase 3.1 — browsers cannot open raw TCP libp2p, they need WSS.
	// When WebSocketListen is set, we add the multiaddr to the listen
	// list; go-libp2p's default transport stack includes the WS driver,
	// so no extra option is needed. Browsers reach this listener via
	// a reverse proxy (Caddy or Cloudflare Tunnel) that terminates TLS
	// and forwards WebSocket upgrades. The multiaddr advertised back
	// to browsers uses /wss to signal TLS expectation.
	if cfg.WebSocketListen != "" {
		addrs = append(addrs, cfg.WebSocketListen)
	}

	opts := []libp2p.Option{
		libp2p.Identity(cfg.PrivKey),
		libp2p.ListenAddrStrings(addrs...),
	}
	if cfg.DisableRelay {
		opts = append(opts, libp2p.DisableRelay())
	}

	if cfg.EnableRelayService {
		// Production tuning would pass relay.WithResources; for now accept
		// the defaults + explicit infinite limits so tests are not throttled
		// by the default 128-reservation cap under heavy integration.
		opts = append(opts, libp2p.EnableRelayService(relayv2.WithInfiniteLimits()))
	}

	if len(cfg.StaticRelays) > 0 {
		// Default AutoRelay waits for 4 candidates and 15s of boot delay
		// before enabling. For deployments with a small curated relay set
		// (typical Aevia topology: 3-5 globally-distributed Relay Nodes),
		// we tune these down so a single reserved relay is enough.
		autorelayOpts := []autorelay.Option{
			autorelay.WithMinCandidates(1),
			autorelay.WithNumRelays(1),
			autorelay.WithBootDelay(0),
			autorelay.WithMinInterval(time.Second),
		}
		opts = append(opts, libp2p.EnableAutoRelayWithStaticRelays(cfg.StaticRelays, autorelayOpts...))
	}

	if cfg.EnableNATService {
		opts = append(opts, libp2p.EnableNATService())
	}

	switch cfg.ForceReachability {
	case "public":
		opts = append(opts, libp2p.ForceReachabilityPublic())
	case "private":
		opts = append(opts, libp2p.ForceReachabilityPrivate())
	case "":
		// no override
	default:
		return nil, fmt.Errorf("node: unknown ForceReachability value %q (want public, private, or empty)", cfg.ForceReachability)
	}

	h, err := libp2p.New(opts...)
	if err != nil {
		return nil, fmt.Errorf("node: libp2p.New: %w", err)
	}

	return &Node{host: h}, nil
}

func (n *Node) Host() host.Host { return n.host }

func (n *Node) PeerID() peer.ID { return n.host.ID() }

func (n *Node) Close(_ context.Context) error {
	if n == nil || n.host == nil {
		return nil
	}
	return n.host.Close()
}
