package main

import (
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/config"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/identity"
)

// TestBuildNodeConfigPropagatesWebSocketListen covers Fase 3.1: the
// --ws-listen flag / AEVIA_WS_LISTEN env must reach node.Config so
// browsers running js-libp2p can dial the provider over WSS.
func TestBuildNodeConfigPropagatesWebSocketListen(t *testing.T) {
	priv, err := identity.LoadOrCreate(t.TempDir())
	if err != nil {
		t.Fatalf("identity: %v", err)
	}
	const wsAddr = "/ip4/127.0.0.1/tcp/4002/ws"
	nc, err := buildNodeConfig(config.Config{
		Mode:            config.ModeProvider,
		Listen:          "/ip4/127.0.0.1/tcp/0",
		WebSocketListen: wsAddr,
	}, priv)
	if err != nil {
		t.Fatalf("buildNodeConfig: %v", err)
	}
	if nc.WebSocketListen != wsAddr {
		t.Errorf("WebSocketListen = %q, want %q", nc.WebSocketListen, wsAddr)
	}
}

func TestBuildNodeConfigProviderWithoutRelays(t *testing.T) {
	priv, err := identity.LoadOrCreate(t.TempDir())
	if err != nil {
		t.Fatalf("identity: %v", err)
	}

	nc, err := buildNodeConfig(config.Config{
		Mode:   config.ModeProvider,
		Listen: "/ip4/127.0.0.1/tcp/0",
	}, priv)
	if err != nil {
		t.Fatalf("buildNodeConfig: %v", err)
	}
	if nc.EnableRelayService {
		t.Error("provider mode should not enable relay service")
	}
	if nc.EnableNATService {
		t.Error("provider mode should not enable NAT service by default")
	}
	if len(nc.StaticRelays) != 0 {
		t.Errorf("StaticRelays = %d, want 0", len(nc.StaticRelays))
	}
}

func TestBuildNodeConfigProviderWithRelays(t *testing.T) {
	priv, err := identity.LoadOrCreate(t.TempDir())
	if err != nil {
		t.Fatalf("identity: %v", err)
	}

	// Use a real multiaddr that ParseBootstrapPeers can decode.
	const validRelay = "/ip4/203.0.113.1/tcp/4001/p2p/12D3KooWAnm7v7TKyVmsJDhv9HsGTKMvVdwdm3G7vxYCmY5qzb7u"
	nc, err := buildNodeConfig(config.Config{
		Mode:       config.ModeProvider,
		Listen:     "/ip4/127.0.0.1/tcp/0",
		RelayPeers: validRelay,
	}, priv)
	if err != nil {
		t.Fatalf("buildNodeConfig: %v", err)
	}
	if len(nc.StaticRelays) != 1 {
		t.Fatalf("StaticRelays = %d, want 1", len(nc.StaticRelays))
	}
	if nc.EnableRelayService {
		t.Error("provider with relay peers should not itself run relay service")
	}
}

func TestBuildNodeConfigRelayMode(t *testing.T) {
	priv, err := identity.LoadOrCreate(t.TempDir())
	if err != nil {
		t.Fatalf("identity: %v", err)
	}

	nc, err := buildNodeConfig(config.Config{
		Mode:              config.ModeRelay,
		Listen:            "/ip4/0.0.0.0/tcp/4001",
		ForceReachability: "public",
	}, priv)
	if err != nil {
		t.Fatalf("buildNodeConfig: %v", err)
	}
	if !nc.EnableRelayService {
		t.Error("relay mode must enable relay service")
	}
	if !nc.EnableNATService {
		t.Error("relay mode must enable NAT service")
	}
	if len(nc.StaticRelays) != 0 {
		t.Error("relay mode should not set StaticRelays")
	}
	if nc.ForceReachability != "public" {
		t.Errorf("ForceReachability = %q, want public", nc.ForceReachability)
	}
}

func TestBuildNodeConfigRejectsBadRelays(t *testing.T) {
	priv, err := identity.LoadOrCreate(t.TempDir())
	if err != nil {
		t.Fatalf("identity: %v", err)
	}
	_, err = buildNodeConfig(config.Config{
		Mode:       config.ModeProvider,
		Listen:     "/ip4/127.0.0.1/tcp/0",
		RelayPeers: "garbage-multiaddr",
	}, priv)
	if err == nil {
		t.Fatal("buildNodeConfig accepted garbage relay peer")
	}
}
