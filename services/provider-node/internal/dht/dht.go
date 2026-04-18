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

	"github.com/ipfs/go-cid"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"

	dht "github.com/libp2p/go-libp2p-kad-dht"
)

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
