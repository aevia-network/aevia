// meshdebug — a tiny go-libp2p client that dials one or more Aevia
// provider multiaddrs over WebSocket, runs identify, subscribes to
// a GossipSub topic, and prints every event in flat, greppable text.
//
// Purpose: diagnose the "p2p · N conectado · 0 na sala" regression
// observed in the browser path. The browser uses @chainsafe/libp2p +
// @chainsafe/libp2p-gossipsub; if a Go client (same upstream wire
// protocol, same providers) reproduces the symptom, the bug is
// server-side (identify response or pubsub handler registration). If
// the Go client sees the topic peers correctly, the bug is specific
// to the JavaScript stack — a version mismatch or event-wiring issue
// — and the fix belongs in apps/video/src/lib/mesh/p2p.ts, not in
// provider-node.
//
// Usage:
//
//	meshdebug -bootstrap <MULTIADDR> [-bootstrap <MULTIADDR> ...] \
//	          -topic <SESSION_ID> \
//	          [-duration 60s]
//
// Example:
//
//	meshdebug \
//	  -bootstrap /dns4/provider.aevia.network/tcp/443/wss/p2p/12D3KooWSvprtPXxXHEASpKux1vLyxWpBRYTps39GQrTEpccMjyh \
//	  -bootstrap /dns4/libp2p-fl.aevia.network/tcp/443/wss/p2p/12D3KooWEs9TrvY9Bq59bqLAYxZ3yWJpw33CAggDJ6YpekNvQXSS \
//	  -bootstrap /dns4/libp2p-br.aevia.network/tcp/443/wss/p2p/12D3KooW9pUVkyEKnhB4HHGJbzk5E3cp72rfBK56JDePRkyaMm2k \
//	  -topic s_1776614316927802353
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/event"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/p2p/protocol/identify"
	"github.com/libp2p/go-libp2p/p2p/transport/websocket"
	"github.com/multiformats/go-multiaddr"
)

// bootstrapList is a flag.Value that accepts repeated -bootstrap args.
type bootstrapList []string

func (b *bootstrapList) String() string { return strings.Join(*b, ",") }
func (b *bootstrapList) Set(v string) error {
	*b = append(*b, v)
	return nil
}

func main() {
	var bootstraps bootstrapList
	flag.Var(&bootstraps, "bootstrap", "provider multiaddr to dial; repeat for multiple")
	topic := flag.String("topic", "", "session id (topic = aevia-live-<session>)")
	duration := flag.Duration("duration", 60*time.Second, "how long to stay online observing events")
	flag.Parse()

	if len(bootstraps) == 0 || *topic == "" {
		flag.Usage()
		os.Exit(2)
	}

	topicName := "aevia-live-" + *topic
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	logf("=== meshdebug starting — topic=%s duration=%s bootstraps=%d ===", topicName, duration, len(bootstraps))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Host: WebSocket outbound only. Mirrors browser-side constraint
	// (no TCP listen, no UDP) so the connectivity path we exercise is
	// the same WSS path browsers use. identify is added as a service
	// via libp2p's defaults; we'll query it explicitly per-peer.
	host, err := libp2p.New(
		libp2p.NoListenAddrs,
		libp2p.Transport(websocket.New),
	)
	if err != nil {
		log.Fatalf("libp2p.New: %v", err)
	}
	defer host.Close()
	logf("self peer id: %s", host.ID())

	// Subscribe to identify completion events from libp2p's event bus.
	// This is the CANONICAL signal that a peer's protocol list has
	// been learned. If the browser's gossipsub registrar relied on
	// this event (via libp2p.Components), we should see it too.
	idSub, err := host.EventBus().Subscribe(new(event.EvtPeerIdentificationCompleted))
	if err != nil {
		log.Fatalf("identify subscribe: %v", err)
	}
	defer idSub.Close()

	failSub, err := host.EventBus().Subscribe(new(event.EvtPeerIdentificationFailed))
	if err != nil {
		log.Fatalf("identify fail subscribe: %v", err)
	}
	defer failSub.Close()

	protoSub, err := host.EventBus().Subscribe(new(event.EvtPeerProtocolsUpdated))
	if err != nil {
		log.Fatalf("protocols subscribe: %v", err)
	}
	defer protoSub.Close()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-idSub.Out():
				if !ok {
					return
				}
				ev := evt.(event.EvtPeerIdentificationCompleted)
				protos := make([]string, 0, len(ev.Protocols))
				for _, p := range ev.Protocols {
					protos = append(protos, string(p))
				}
				logf("[identify:done] peer=%s agent=%q protocols=[%s]",
					ev.Peer, ev.AgentVersion, strings.Join(protos, ", "))
			case evt, ok := <-failSub.Out():
				if !ok {
					return
				}
				ev := evt.(event.EvtPeerIdentificationFailed)
				logf("[identify:fail] peer=%s reason=%v", ev.Peer, ev.Reason)
			case evt, ok := <-protoSub.Out():
				if !ok {
					return
				}
				ev := evt.(event.EvtPeerProtocolsUpdated)
				added := make([]string, 0, len(ev.Added))
				for _, p := range ev.Added {
					added = append(added, string(p))
				}
				removed := make([]string, 0, len(ev.Removed))
				for _, p := range ev.Removed {
					removed = append(removed, string(p))
				}
				logf("[identify:push] peer=%s +[%s] -[%s]",
					ev.Peer, strings.Join(added, ", "), strings.Join(removed, ", "))
			}
		}
	}()

	// Dial each bootstrap.
	var targets []peer.AddrInfo
	for _, addr := range bootstraps {
		ma, err := multiaddr.NewMultiaddr(addr)
		if err != nil {
			logf("[bootstrap:parse-fail] addr=%s err=%v", addr, err)
			continue
		}
		info, err := peer.AddrInfoFromP2pAddr(ma)
		if err != nil {
			logf("[bootstrap:peerinfo-fail] addr=%s err=%v", addr, err)
			continue
		}
		targets = append(targets, *info)
		logf("[dial:start] peer=%s addr=%s", info.ID, addr)
		dialCtx, dialCancel := context.WithTimeout(ctx, 10*time.Second)
		if err := host.Connect(dialCtx, *info); err != nil {
			logf("[dial:fail] peer=%s err=%v", info.ID, err)
		} else {
			logf("[dial:ok] peer=%s", info.ID)
		}
		dialCancel()
	}

	// Let identify settle (events from the goroutine above should fire
	// within a second or two per peer).
	time.Sleep(3 * time.Second)

	// Explicit snapshot: what does host.Peerstore say about each peer
	// RIGHT NOW? This is exactly what the browser's peerStore would
	// report — the source the gossipsub registrar reads to decide
	// whether a peer "has" meshsub.
	logf("--- peerstore snapshot after 3s settle ---")
	for _, t := range targets {
		protos, err := host.Peerstore().GetProtocols(t.ID)
		if err != nil {
			logf("[peerstore] peer=%s err=%v", t.ID, err)
			continue
		}
		names := make([]string, 0, len(protos))
		for _, p := range protos {
			names = append(names, string(p))
		}
		logf("[peerstore] peer=%s protocols=[%s]", t.ID, strings.Join(names, ", "))
	}

	// Explicit force-identify: what does identify ACTUALLY return when
	// we ask a fresh connection? Uses libp2p's built-in id service.
	logf("--- explicit identify per peer ---")
	idSvc, ok := host.(interface {
		IDService() identify.IDService
	})
	if ok {
		for _, t := range targets {
			conns := host.Network().ConnsToPeer(t.ID)
			if len(conns) == 0 {
				logf("[explicit-id] peer=%s status=no-connection", t.ID)
				continue
			}
			ch := idSvc.IDService().IdentifyWait(conns[0])
			select {
			case <-ch:
				protos, _ := host.Peerstore().GetProtocols(t.ID)
				names := make([]string, 0, len(protos))
				for _, p := range protos {
					names = append(names, string(p))
				}
				logf("[explicit-id] peer=%s done protocols=[%s]", t.ID, strings.Join(names, ", "))
			case <-time.After(5 * time.Second):
				logf("[explicit-id] peer=%s timeout", t.ID)
			}
		}
	} else {
		logf("[explicit-id] host does not expose IDService()")
	}

	// Boot gossipsub + subscribe.
	ps, err := pubsub.NewGossipSub(ctx, host)
	if err != nil {
		log.Fatalf("gossipsub: %v", err)
	}
	t, err := ps.Join(topicName)
	if err != nil {
		log.Fatalf("topic.Join %s: %v", topicName, err)
	}
	sub, err := t.Subscribe()
	if err != nil {
		log.Fatalf("topic.Subscribe: %v", err)
	}
	defer sub.Cancel()
	logf("[gossipsub:subscribed] topic=%s", topicName)

	go func() {
		for {
			msg, err := sub.Next(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				logf("[gossipsub:next-err] err=%v", err)
				return
			}
			logf("[gossipsub:msg] from=%s size=%d", msg.ReceivedFrom, len(msg.Data))
		}
	}()

	// Poll topic.ListPeers every 2s so we see mesh formation over time.
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	// Network notifications — connection open/close events.
	host.Network().Notify(&network.NotifyBundle{
		ConnectedF: func(_ network.Network, c network.Conn) {
			logf("[net:connected] peer=%s direction=%s addr=%s",
				c.RemotePeer(), c.Stat().Direction, c.RemoteMultiaddr())
		},
		DisconnectedF: func(_ network.Network, c network.Conn) {
			logf("[net:disconnected] peer=%s", c.RemotePeer())
		},
	})

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	deadline := time.After(*duration)

	for {
		select {
		case <-stop:
			logf("=== stopped by signal ===")
			return
		case <-deadline:
			logf("=== duration reached ===")
			return
		case <-ticker.C:
			topicPeers := t.ListPeers()
			names := make([]string, 0, len(topicPeers))
			for _, p := range topicPeers {
				names = append(names, p.String())
			}
			logf("[poll] topic_peers=%d mesh=[%s]", len(topicPeers), strings.Join(names, ", "))
		}
	}
}

func logf(format string, args ...interface{}) {
	fmt.Printf(time.Now().Format("15:04:05.000")+" "+format+"\n", args...)
}
