package dht

import (
	"fmt"
	"strings"

	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/multiformats/go-multiaddr"
)

// ParseBootstrapPeers converts a comma-separated list of /p2p-terminated
// multiaddrs into []peer.AddrInfo suitable for DHT.Bootstrap.
//
// Example input:
//
//	"/ip4/1.2.3.4/tcp/4001/p2p/12D3Koo...A,/ip4/5.6.7.8/tcp/4001/p2p/12D3Koo...B"
//
// Empty input returns (nil, nil) — nodes without a bootstrap list still
// work as standalone seeds for others.
func ParseBootstrapPeers(s string) ([]peer.AddrInfo, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	parts := strings.Split(s, ",")
	out := make([]peer.AddrInfo, 0, len(parts))
	for _, raw := range parts {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		ma, err := multiaddr.NewMultiaddr(raw)
		if err != nil {
			return nil, fmt.Errorf("bootstrap: parse multiaddr %q: %w", raw, err)
		}
		info, err := peer.AddrInfoFromP2pAddr(ma)
		if err != nil {
			return nil, fmt.Errorf("bootstrap: peer info from %q: %w", raw, err)
		}
		out = append(out, *info)
	}
	return out, nil
}
