// Aevia Provider Node — serves pinned HLS content over both plain HTTP and
// libp2p streams (via go-libp2p-http in later milestones). Current milestone
// brings the libp2p host online with a persistent identity; HTTP mux, DHT,
// relay, and pinning storage land in subsequent iterations.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

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

	log.Printf("aevia provider-node started peer_id=%s data_dir=%s listen=%s", n.PeerID(), *dataDir, *listen)
	for _, addr := range n.Host().Addrs() {
		log.Printf("listening addr=%s/p2p/%s", addr, n.PeerID())
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Println("shutdown signal received")
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
