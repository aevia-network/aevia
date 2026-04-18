package config_test

import (
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/config"
)

func TestParseRelayPeersFromFlag(t *testing.T) {
	t.Setenv("AEVIA_RELAY_PEERS", "")
	cfg, err := config.Parse([]string{"-relay-peers", "/ip4/1.2.3.4/tcp/4001/p2p/12D3KooWA,/ip4/5.6.7.8/tcp/4001/p2p/12D3KooWB"})
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if cfg.RelayPeers == "" {
		t.Fatal("RelayPeers is empty")
	}
}

func TestParseRelayPeersFromEnv(t *testing.T) {
	t.Setenv("AEVIA_RELAY_PEERS", "/ip4/9.9.9.9/tcp/4001/p2p/12D3KooWZ")
	cfg, err := config.Parse(nil)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if cfg.RelayPeers != "/ip4/9.9.9.9/tcp/4001/p2p/12D3KooWZ" {
		t.Fatalf("RelayPeers = %q", cfg.RelayPeers)
	}
}

func TestParseForceReachability(t *testing.T) {
	t.Setenv("AEVIA_FORCE_REACHABILITY", "")
	for _, want := range []string{"public", "private"} {
		cfg, err := config.Parse([]string{"-force-reachability", want})
		if err != nil {
			t.Fatalf("Parse(%q): %v", want, err)
		}
		if cfg.ForceReachability != want {
			t.Fatalf("ForceReachability = %q, want %q", cfg.ForceReachability, want)
		}
	}
}

func TestParseForceReachabilityFromEnv(t *testing.T) {
	t.Setenv("AEVIA_FORCE_REACHABILITY", "public")
	cfg, err := config.Parse(nil)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if cfg.ForceReachability != "public" {
		t.Fatalf("ForceReachability = %q, want public", cfg.ForceReachability)
	}
}
