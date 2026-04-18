// Aevia Provider Node — serves pinned HLS content over both plain HTTP and
// libp2p streams (via go-libp2p-http), and announces the CIDs it pins via
// Kademlia DHT so any viewer can discover it by CID alone.
//
// Milestone 3 adds the DHT layer. Milestone 4 adds Circuit Relay v2 for
// NAT traversal. BadgerDB-backed persistent pinning lands in Milestone 5.
package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/config"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/identity"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/logging"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/node"
)

const shutdownGracePeriod = 10 * time.Second

func main() {
	logger := logging.Default()
	if err := run(os.Args[1:], logger); err != nil {
		logger.Fatal().Err(err).Msg("aevia provider-node terminated")
	}
}

func run(args []string, logger zerolog.Logger) error {
	cfg, err := config.Parse(args)
	if err != nil {
		return err
	}
	if cfg.Mode == config.ModeRelay {
		return errors.New("relay mode is not implemented yet (Milestone 4 adds Circuit Relay v2, DHT bootstrap, tracker)")
	}

	priv, err := identity.LoadOrCreate(cfg.DataDir)
	if err != nil {
		return err
	}

	n, err := node.New(node.Config{
		PrivKey:     priv,
		ListenAddrs: []string{cfg.Listen},
	})
	if err != nil {
		return err
	}

	srv := httpx.NewServer(n.Host())
	content.Register(srv)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Boot the DHT. For a Provider Node we run in server mode so the node
	// contributes to routing + answers queries on behalf of others.
	d, err := aeviadht.New(ctx, n.Host(), aeviadht.ModeServer)
	if err != nil {
		return err
	}

	seeds, err := aeviadht.ParseBootstrapPeers(cfg.BootstrapPeers)
	if err != nil {
		return err
	}
	if err := d.Bootstrap(ctx, seeds); err != nil {
		// Log but do not abort — a fresh node with no seeds is a valid seed itself.
		logger.Warn().Err(err).Str("event", "dht_bootstrap_warn").Msg("dht bootstrap incomplete")
	}

	logger.Info().
		Str("event", "node_boot").
		Str("mode", string(cfg.Mode)).
		Str("peer_id", n.PeerID().String()).
		Str("data_dir", cfg.DataDir).
		Str("listen", cfg.Listen).
		Str("http_addr", cfg.HTTPAddr).
		Int("bootstrap_seeds", len(seeds)).
		Msg("provider-node started")

	for _, addr := range n.Host().Addrs() {
		logger.Info().
			Str("event", "listening_libp2p").
			Str("addr", addr.String()+"/p2p/"+n.PeerID().String()).
			Msg("listening on libp2p transport")
	}

	tcpListener, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return err
	}

	tcpErr := make(chan error, 1)
	libp2pErr := make(chan error, 1)
	go func() { tcpErr <- srv.ServeHTTPOn(ctx, tcpListener) }()
	go func() { libp2pErr <- srv.ServeLibp2p(ctx) }()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-stop:
		logger.Info().Str("event", "shutdown_signal").Msg("shutdown signal received")
	case err := <-tcpErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error().Err(err).Str("event", "tcp_transport_error").Msg("tcp transport error")
		}
	case err := <-libp2pErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error().Err(err).Str("event", "libp2p_transport_error").Msg("libp2p transport error")
		}
	}

	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), shutdownGracePeriod)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, context.DeadlineExceeded) {
		logger.Error().Err(err).Str("event", "shutdown_error").Msg("http shutdown")
	}
	if err := d.Close(); err != nil {
		logger.Error().Err(err).Str("event", "dht_close_error").Msg("dht close")
	}
	if err := n.Close(context.Background()); err != nil {
		return err
	}
	logger.Info().Str("event", "shutdown_complete").Msg("shutdown complete")
	return nil
}
