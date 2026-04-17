// Package node wires the libp2p host lifecycle for a Provider Node.
package node

import (
	"context"
	"errors"
	"fmt"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
)

// Config groups the knobs required to boot a Node.
type Config struct {
	PrivKey        crypto.PrivKey
	ListenAddrs    []string
	DisableRelay   bool
	DisableMetrics bool
}

// Node owns a libp2p host and exposes lifecycle helpers.
type Node struct {
	host host.Host
}

// New builds a libp2p host from cfg but does NOT start any application
// services on top of it. That is deliberate — later milestones add the HTTP
// mux, DHT, relay, and pinning storage as independent modules.
func New(cfg Config) (*Node, error) {
	if cfg.PrivKey == nil {
		return nil, errors.New("node: PrivKey is required")
	}

	addrs := cfg.ListenAddrs
	if len(addrs) == 0 {
		addrs = []string{"/ip4/0.0.0.0/tcp/0"}
	}

	opts := []libp2p.Option{
		libp2p.Identity(cfg.PrivKey),
		libp2p.ListenAddrStrings(addrs...),
	}
	if cfg.DisableRelay {
		opts = append(opts, libp2p.DisableRelay())
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
