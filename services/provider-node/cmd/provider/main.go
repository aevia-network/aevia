// Aevia Provider Node — serves pinned HLS content over both plain HTTP and
// libp2p streams (via go-libp2p-http). Milestone 1 brings the libp2p host
// online with a persistent identity, a dual-transport HTTP mux (libp2p
// stream + plain TCP), fixture HLS segments, unified config, graceful
// shutdown, and structured JSON logs. DHT, relay, and BadgerDB-backed
// pinning land in subsequent milestones.
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

	logger.Info().
		Str("event", "node_boot").
		Str("mode", string(cfg.Mode)).
		Str("peer_id", n.PeerID().String()).
		Str("data_dir", cfg.DataDir).
		Str("listen", cfg.Listen).
		Str("http_addr", cfg.HTTPAddr).
		Msg("provider-node started")

	for _, addr := range n.Host().Addrs() {
		logger.Info().
			Str("event", "listening_libp2p").
			Str("addr", addr.String()+"/p2p/"+n.PeerID().String()).
			Msg("listening on libp2p transport")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

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
	if err := n.Close(context.Background()); err != nil {
		return err
	}
	logger.Info().Str("event", "shutdown_complete").Msg("shutdown complete")
	return nil
}
