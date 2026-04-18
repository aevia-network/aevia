package main

import (
	"fmt"

	"github.com/libp2p/go-libp2p/core/crypto"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/config"
	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/node"
)

// buildNodeConfig turns the flat app config into a node.Config, expanding
// the comma-separated multiaddr strings into peer.AddrInfo slices and
// selecting the right relay/NAT options for the chosen mode.
//
// Extracted as a pure function so the mapping is unit-testable without
// standing up a real libp2p host.
func buildNodeConfig(appCfg config.Config, priv crypto.PrivKey) (node.Config, error) {
	staticRelays, err := aeviadht.ParseBootstrapPeers(appCfg.RelayPeers)
	if err != nil {
		return node.Config{}, fmt.Errorf("parse relay-peers: %w", err)
	}

	nc := node.Config{
		PrivKey:           priv,
		ListenAddrs:       []string{appCfg.Listen},
		ForceReachability: appCfg.ForceReachability,
	}

	switch appCfg.Mode {
	case config.ModeRelay:
		// Relay Node: Circuit Relay v2 HOP + AutoNAT service. No AutoRelay
		// client (a relay never itself needs to go through another relay).
		nc.EnableRelayService = true
		nc.EnableNATService = true
	case config.ModeProvider:
		// Provider Node: if relay peers were configured, reserve slots on
		// them so NAT-bound providers stay reachable via /p2p-circuit addrs.
		if len(staticRelays) > 0 {
			nc.StaticRelays = staticRelays
		}
	}
	return nc, nil
}
