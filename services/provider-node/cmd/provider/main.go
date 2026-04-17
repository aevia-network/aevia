// Aevia Provider Node — serves pinned HLS content over both plain HTTP and
// libp2p streams (via go-libp2p-http). Milestone 1 brings the libp2p host
// online with a persistent identity, a dual-transport HTTP mux (libp2p
// stream + plain TCP), and fixture HLS segments. DHT, relay, and
// BadgerDB-backed pinning land in subsequent milestones.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/identity"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/node"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("aevia provider-node: %v", err)
	}
}

func run() error {
	dataDir := flag.String("data-dir", defaultDataDir(), "directory for persistent state (identity key, pinning storage)")
	listen := flag.String("listen", "/ip4/0.0.0.0/tcp/0", "libp2p multiaddr to listen on")
	httpAddr := flag.String("http-addr", "127.0.0.1:8080", "plain HTTP listen address for Provider Público path")
	flag.Parse()

	priv, err := identity.LoadOrCreate(*dataDir)
	if err != nil {
		return fmt.Errorf("identity: %w", err)
	}

	n, err := node.New(node.Config{
		PrivKey:     priv,
		ListenAddrs: []string{*listen},
	})
	if err != nil {
		return fmt.Errorf("node boot: %w", err)
	}

	srv := httpx.NewServer(n.Host())
	content.Register(srv)

	log.Printf("aevia provider-node started peer_id=%s data_dir=%s listen=%s http=%s", n.PeerID(), *dataDir, *listen, *httpAddr)
	for _, addr := range n.Host().Addrs() {
		log.Printf("listening libp2p_addr=%s/p2p/%s", addr, n.PeerID())
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	tcpListener, err := net.Listen("tcp", *httpAddr)
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

func defaultDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return filepath.Join(".", ".aevia-provider-node")
	}
	return filepath.Join(home, ".aevia", "provider-node")
}
