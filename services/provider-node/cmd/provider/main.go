// Aevia Provider Node — serves pinned HLS content over both plain HTTP and
// libp2p streams (via go-libp2p-http). Milestone 1 brings the libp2p host
// online with a persistent identity, a dual-transport HTTP mux (libp2p
// stream + plain TCP), fixture HLS segments, and unified config. DHT, relay,
// and BadgerDB-backed pinning land in subsequent milestones.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/config"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/identity"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/node"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		log.Fatalf("aevia provider-node: %v", err)
	}
}

func run(args []string) error {
	cfg, err := config.Parse(args)
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}

	if cfg.Mode == config.ModeRelay {
		// Relay mode is implemented in a later milestone; for now refuse
		// to boot so operators don't silently run a provider when they
		// asked for a relay.
		return errors.New("relay mode is not implemented yet (Milestone 4 adds Circuit Relay v2, DHT bootstrap, tracker)")
	}

	priv, err := identity.LoadOrCreate(cfg.DataDir)
	if err != nil {
		return fmt.Errorf("identity: %w", err)
	}

	n, err := node.New(node.Config{
		PrivKey:     priv,
		ListenAddrs: []string{cfg.Listen},
	})
	if err != nil {
		return fmt.Errorf("node boot: %w", err)
	}

	srv := httpx.NewServer(n.Host())
	content.Register(srv)

	log.Printf("aevia provider-node started mode=%s peer_id=%s data_dir=%s listen=%s http=%s", cfg.Mode, n.PeerID(), cfg.DataDir, cfg.Listen, cfg.HTTPAddr)
	for _, addr := range n.Host().Addrs() {
		log.Printf("listening libp2p_addr=%s/p2p/%s", addr, n.PeerID())
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	tcpListener, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return fmt.Errorf("http listen: %w", err)
	}

	tcpErr := make(chan error, 1)
	libp2pErr := make(chan error, 1)
	go func() { tcpErr <- srv.ServeHTTPOn(ctx, tcpListener) }()
	go func() { libp2pErr <- srv.ServeLibp2p(ctx) }()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-stop:
		log.Println("shutdown signal received")
	case err := <-tcpErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("tcp transport error: %v", err)
		}
	case err := <-libp2pErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("libp2p transport error: %v", err)
		}
	}

	cancel()
	_ = srv.Close()
	if err := n.Close(context.Background()); err != nil {
		return fmt.Errorf("close host: %w", err)
	}
	log.Println("shutdown complete")
	return nil
}
