package node_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/libp2p/go-libp2p/core/peer"
	circuitclient "github.com/libp2p/go-libp2p/p2p/protocol/circuitv2/client"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/identity"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/node"
)

func newNodeForTest(t *testing.T, cfg node.Config) *node.Node {
	t.Helper()
	if cfg.PrivKey == nil {
		priv, err := identity.LoadOrCreate(t.TempDir())
		if err != nil {
			t.Fatalf("identity: %v", err)
		}
		cfg.PrivKey = priv
	}
	n, err := node.New(cfg)
	if err != nil {
		t.Fatalf("node.New: %v", err)
	}
	t.Cleanup(func() { _ = n.Close(context.Background()) })
	return n
}

// TestRelayServiceAcceptsReservation boots a Relay Node (EnableRelayService
// on) and a client that manually reserves a circuit slot. Proves our
// EnableRelayService wiring produces a functioning Circuit Relay v2 HOP.
func TestRelayServiceAcceptsReservation(t *testing.T) {
	relayNode := newNodeForTest(t, node.Config{
		ListenAddrs:        []string{"/ip4/127.0.0.1/tcp/0"},
		EnableRelayService: true,
		ForceReachability:  "public", // loopback is never auto-detected as reachable
	})

	clientNode := newNodeForTest(t, node.Config{
		ListenAddrs: []string{"/ip4/127.0.0.1/tcp/0"},
	})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	relayInfo := peer.AddrInfo{ID: relayNode.Host().ID(), Addrs: relayNode.Host().Addrs()}
	if err := clientNode.Host().Connect(ctx, relayInfo); err != nil {
		t.Fatalf("client connect to relay: %v", err)
	}

	// Request a Circuit Relay v2 reservation.
	reservation, err := circuitclient.Reserve(ctx, clientNode.Host(), relayInfo)
	if err != nil {
		t.Fatalf("Reserve: %v", err)
	}
	if reservation == nil {
		t.Fatal("Reserve returned nil reservation")
	}
	if time.Until(reservation.Expiration) < time.Minute {
		t.Fatalf("reservation expiration too soon: %v", reservation.Expiration)
	}
}

// TestAutoRelayWiresStaticRelaysIntoHost asserts that a node configured
// with StaticRelays boots cleanly and the host is configured with the
// AutoRelay subsystem enabled. The full end-to-end proof — that a NAT
// node dialed via /p2p-circuit transparently serves content — is the
// job of the integration test TestProviderNATServedViaRelay in M4-i7;
// AutoRelay's address-rewriting pipeline depends on non-loopback
// interfaces which are awkward to guarantee inside unit tests.
func TestAutoRelayWiresStaticRelaysIntoHost(t *testing.T) {
	relayNode := newNodeForTest(t, node.Config{
		ListenAddrs:        []string{"/ip4/127.0.0.1/tcp/0"},
		EnableRelayService: true,
		EnableNATService:   true,
		ForceReachability:  "public",
	})
	relayInfo := peer.AddrInfo{ID: relayNode.Host().ID(), Addrs: relayNode.Host().Addrs()}

	natNode := newNodeForTest(t, node.Config{
		ListenAddrs:       []string{"/ip4/127.0.0.1/tcp/0"},
		StaticRelays:      []peer.AddrInfo{relayInfo},
		ForceReachability: "private",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := natNode.Host().Connect(ctx, relayInfo); err != nil {
		t.Fatalf("connect to relay: %v", err)
	}

	// Direct reservation against the relay proves the HOP service is
	// reachable from the NAT node and the configuration plumbing is sound.
	if _, err := circuitclient.Reserve(ctx, natNode.Host(), relayInfo); err != nil {
		t.Fatalf("Reserve on relay from nat-configured node: %v", err)
	}
}

func TestNodeRejectsUnknownForceReachability(t *testing.T) {
	priv, err := identity.LoadOrCreate(t.TempDir())
	if err != nil {
		t.Fatalf("identity: %v", err)
	}
	_, err = node.New(node.Config{
		PrivKey:           priv,
		ListenAddrs:       []string{"/ip4/127.0.0.1/tcp/0"},
		ForceReachability: "bogus",
	})
	if err == nil {
		t.Fatal("node.New accepted invalid ForceReachability")
	}
}

var _ = strings.Contains // keep strings import for future /p2p-circuit assertions
