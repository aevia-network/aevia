// Package mesh wraps go-libp2p-pubsub so Provider Nodes participate in
// the GossipSub mesh for every live session they host. Without this,
// browser viewers that dial a Provider Node via WebSocket connect to
// it just fine at the libp2p layer but never discover each other as
// topic peers — the Provider sees each viewer's subscribe() call,
// has no mesh of its own to gossip it on, and swallows the
// subscription-change events. Result: `topicPeers` stays empty on
// every viewer no matter how many actually joined.
//
// Fase 3.1 ships libp2p WSS handshake (browsers dial Providers). Fase
// 3.1-bugfix (this package) completes the topic-mesh wiring so
// subscription-change events propagate and the viewer-side chip
// reads `N na sala` correctly.
package mesh

import (
	"context"
	"errors"
	"fmt"
	"sync"

	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
)

// TopicPrefix is the shared naming convention for live-session GossipSub
// topics. Browsers compute the same name from `aevia-live-{sessionId}`;
// Providers must join the same string for the mesh to form. Anyone
// changing this MUST update `apps/video/src/lib/mesh/p2p.ts` in lockstep.
const TopicPrefix = "aevia-live-"

// Service owns a long-lived GossipSub instance bound to a libp2p host.
// Tracks topic subscriptions per sessionID so lifecycle cleanup on
// session end is straightforward and idempotent.
type Service struct {
	ps     *pubsub.PubSub
	mu     sync.Mutex
	topics map[string]*pubsub.Topic
	subs   map[string]*pubsub.Subscription
}

// New boots a GossipSub service on top of the given libp2p host. The
// returned Service runs background goroutines that live as long as ctx;
// callers should scope ctx to the process or service lifecycle they
// want pubsub to match.
func New(ctx context.Context, h host.Host) (*Service, error) {
	if h == nil {
		return nil, errors.New("mesh: host is required")
	}
	ps, err := pubsub.NewGossipSub(ctx, h)
	if err != nil {
		return nil, fmt.Errorf("mesh: new gossipsub: %w", err)
	}
	return &Service{
		ps:     ps,
		topics: make(map[string]*pubsub.Topic),
		subs:   make(map[string]*pubsub.Subscription),
	}, nil
}

// JoinSession subscribes the provider to the live-session topic. Call
// this from the WHIP OnSession hook so every session the provider
// hosts participates in browser-side mesh discovery. Idempotent —
// second call for the same sessionID is a no-op.
func (s *Service) JoinSession(sessionID string) error {
	if sessionID == "" {
		return errors.New("mesh: sessionID is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	name := TopicPrefix + sessionID
	if _, ok := s.topics[name]; ok {
		return nil
	}
	t, err := s.ps.Join(name)
	if err != nil {
		return fmt.Errorf("mesh: join topic %s: %w", name, err)
	}
	sub, err := t.Subscribe()
	if err != nil {
		_ = t.Close()
		return fmt.Errorf("mesh: subscribe topic %s: %w", name, err)
	}
	s.topics[name] = t
	s.subs[name] = sub
	// Drain the subscription goroutine — we don't act on published
	// messages yet (Fase 3.2 will wire chunk-relay here), but the
	// pubsub library requires the subscription to be read from or
	// it backpressures the whole mesh. Goroutine exits on sub.Cancel()
	// in LeaveSession.
	go func(sub *pubsub.Subscription) {
		ctx := context.Background()
		for {
			if _, err := sub.Next(ctx); err != nil {
				return
			}
		}
	}(sub)
	return nil
}

// LeaveSession cancels the subscription and closes the topic. Idempotent.
func (s *Service) LeaveSession(sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	name := TopicPrefix + sessionID
	sub, hasSub := s.subs[name]
	t, hasTopic := s.topics[name]
	delete(s.subs, name)
	delete(s.topics, name)
	if hasSub {
		sub.Cancel()
	}
	if hasTopic {
		return t.Close()
	}
	return nil
}

// TopicPeers returns peers currently seen on the given session's topic,
// as reported by the GossipSub mesh. Used by tests + /healthz to
// observe mesh formation without poking into the pubsub internals.
func (s *Service) TopicPeers(sessionID string) []peer.ID {
	s.mu.Lock()
	t, ok := s.topics[TopicPrefix+sessionID]
	s.mu.Unlock()
	if !ok {
		return nil
	}
	return t.ListPeers()
}

// Pubsub exposes the raw GossipSub handle for callers that need to
// publish messages (e.g. Fase 3.2 chunk-availability gossip). Keep
// this narrow — most callers should use JoinSession / LeaveSession.
func (s *Service) Pubsub() *pubsub.PubSub { return s.ps }
