package integration_test

import (
	"context"
	"testing"
	"time"

	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/p2p/transport/websocket"
	"github.com/multiformats/go-multiaddr"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/mesh"
)

// TestLibp2pMeshFormation covers the Fase 3.1 topic-mesh behaviour that
// Provider Nodes MUST deliver so browser viewers see each other as
// topic peers. The regression this guards against is the one that hit
// prod 2026-04-19: 3 real browsers connected with ?p2p=1, each chip
// reading `p2p · 1 conectado · 0 na sala` because the Provider's
// libp2p host had no GossipSub instance — subscription-change events
// went nowhere.
//
// Shape:
//
//   Provider (with mesh.Service) ←── WS ──┬── Client A (subscribe topic)
//                                         ├── Client B (subscribe topic)
//                                         └── Client C (subscribe topic)
//
// Two assertions guard distinct properties:
//
//   (1) Every client's `topic.ListPeers()` contains the Provider. That
//       proves the Provider joined the mesh, its subscription
//       propagated, and the subscription-change event counter on the
//       browser side will register N ≥ 1. Before mesh.Service this
//       returned zero — the "0 na sala" symptom.
//
//   (2) A message published by one client is received by all other
//       clients. GossipSub routes messages through the mesh using
//       the Provider as relay (since browsers / outbound-only clients
//       aren't directly connected to each other). If (1) passes but
//       (2) fails, the mesh formed but isn't forwarding — different
//       bug class.
//
// NOTE on client↔client visibility: browsers can't accept incoming
// connections, so `topic.ListPeers()` on each browser only returns
// peers among its direct connections (just the Provider here). Seeing
// OTHER browsers in `ListPeers` requires Circuit Relay v2 on the
// Provider + reservation dance on each client — tracked as Fase 3.1c
// future work. The cardinality displayed in the viewer chip
// (`N na sala`) currently reflects directly-observed subs, so it will
// read "1 na sala" (the Provider) not "3 na sala" even with the fix;
// moving to 3 requires relay work. Documented so the chip copy doesn't
// mislead during intermediate QA.
func TestLibp2pMeshFormation(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	const sessionID = "test-mesh-" + "a1b2c3"
	topicName := mesh.TopicPrefix + sessionID

	// Provider: libp2p host on a WebSocket listener (bound to a
	// random ephemeral port on 127.0.0.1) + GossipSub via mesh.Service.
	providerHost, err := libp2p.New(
		libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0/ws"),
		libp2p.Transport(websocket.New),
	)
	if err != nil {
		t.Fatalf("provider host: %v", err)
	}
	t.Cleanup(func() { _ = providerHost.Close() })

	meshSvc, err := mesh.New(ctx, providerHost)
	if err != nil {
		t.Fatalf("mesh.New: %v", err)
	}
	if err := meshSvc.JoinSession(sessionID); err != nil {
		t.Fatalf("mesh.JoinSession: %v", err)
	}

	// Advertise the provider's dialable multiaddr — we pick the /ws one.
	var providerAddr multiaddr.Multiaddr
	for _, a := range providerHost.Addrs() {
		if _, err := a.ValueForProtocol(multiaddr.P_WS); err == nil {
			providerAddr = a
			break
		}
	}
	if providerAddr == nil {
		t.Fatalf("provider has no /ws listen addr, got %v", providerHost.Addrs())
	}
	providerInfo := peer.AddrInfo{
		ID:    providerHost.ID(),
		Addrs: []multiaddr.Multiaddr{providerAddr},
	}

	// Clients: three libp2p hosts simulating browser viewers. Each runs
	// its own GossipSub (same as `@chainsafe/libp2p-gossipsub` in the
	// browser) and joins the same topic.
	type client struct {
		host      peerHost
		topic     *pubsub.Topic
		sub       *pubsub.Subscription
		published bool
	}
	clients := make([]client, 3)
	for i := range clients {
		h, err := libp2p.New(
			libp2p.NoListenAddrs, // outbound only — same as browser constraint
			libp2p.Transport(websocket.New),
		)
		if err != nil {
			t.Fatalf("client[%d] host: %v", i, err)
		}
		t.Cleanup(func() { _ = h.Close() })

		ps, err := pubsub.NewGossipSub(ctx, h)
		if err != nil {
			t.Fatalf("client[%d] gossipsub: %v", i, err)
		}

		if err := h.Connect(ctx, providerInfo); err != nil {
			t.Fatalf("client[%d] dial provider: %v", i, err)
		}

		topic, err := ps.Join(topicName)
		if err != nil {
			t.Fatalf("client[%d] join topic: %v", i, err)
		}
		sub, err := topic.Subscribe()
		if err != nil {
			t.Fatalf("client[%d] subscribe: %v", i, err)
		}
		// Drain subscription so pubsub doesn't backpressure the mesh.
		go func(s *pubsub.Subscription) {
			for {
				if _, err := s.Next(ctx); err != nil {
					return
				}
			}
		}(sub)

		clients[i] = client{host: peerHost{h: h, id: h.ID()}, topic: topic, sub: sub}
	}

	// Give GossipSub its mesh-formation heartbeats: default heartbeat is
	// 1s. 5s is a safe margin; real browsers see the Provider as a topic
	// peer in 1-3s on the same LAN.
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		ok := true
		for i := range clients {
			peers := clients[i].topic.ListPeers()
			sawProvider := false
			for _, p := range peers {
				if p == providerHost.ID() {
					sawProvider = true
					break
				}
			}
			if !sawProvider {
				ok = false
				break
			}
		}
		if ok {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}

	// Assertion (1): every client sees the Provider as a topic peer.
	// This is the specific regression that "0 na sala" in prod exposed.
	for i := range clients {
		peers := clients[i].topic.ListPeers()
		sawProvider := false
		for _, p := range peers {
			if p == providerHost.ID() {
				sawProvider = true
				break
			}
		}
		if !sawProvider {
			t.Errorf("client[%d] does not see Provider as topic peer (got %v) — regression: mesh.Service not joining topic?",
				i, peers)
		}
	}
	// Provider should know about all 3 clients as its topic peers.
	if p := meshSvc.TopicPeers(sessionID); len(p) < 3 {
		t.Errorf("provider sees %d topic peers, want >= 3 (all clients): %v", len(p), p)
	}

	// Sanity: messages flow end-to-end. Client 0 publishes; clients 1+2
	// must receive within 2s. If this part fails but ListPeers passes,
	// the mesh formed but isn't forwarding — different bug class.
	recv := make([]chan struct{}, len(clients))
	for i := range recv {
		recv[i] = make(chan struct{}, 1)
	}
	for i := 1; i < len(clients); i++ {
		go func(idx int) {
			relay, err := clients[idx].topic.Subscribe()
			if err != nil {
				return
			}
			defer relay.Cancel()
			msg, err := relay.Next(ctx)
			if err != nil {
				return
			}
			if msg != nil {
				select {
				case recv[idx] <- struct{}{}:
				default:
				}
			}
		}(i)
	}
	time.Sleep(300 * time.Millisecond) // let the new subs register
	if err := clients[0].topic.Publish(ctx, []byte("hello-mesh")); err != nil {
		t.Fatalf("client[0] publish: %v", err)
	}
	for i := 1; i < len(clients); i++ {
		select {
		case <-recv[i]:
			// got it
		case <-time.After(3 * time.Second):
			t.Errorf("client[%d] did not receive message from client[0] within 3s", i)
		}
	}
}

// peerHost pairs a host with its cached ID so assertions don't reach
// into the host interface repeatedly.
type peerHost struct {
	h  interface{}
	id peer.ID
}
