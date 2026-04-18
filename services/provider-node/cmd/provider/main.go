// Aevia Provider Node — serves pinned HLS content over both plain HTTP and
// libp2p streams (via go-libp2p-http), announces the CIDs it pins via
// Kademlia DHT, and can optionally reserve slots on Circuit Relay v2 Relay
// Nodes so providers behind NAT stay reachable via /p2p-circuit addrs.
//
// The same binary runs as --mode=provider (serves content) or
// --mode=relay (Circuit Relay v2 HOP + AutoNAT service, does NOT serve
// content and does NOT earn pinning rewards).
package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
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
	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

const shutdownGracePeriod = 10 * time.Second

func main() {
	logger := logging.Default()
	args := os.Args[1:]
	err := dispatch(args, os.Stdout)
	if err == nil {
		return
	}
	if !errors.Is(err, errDefaultRun) {
		logger.Fatal().Err(err).Msg("aevia-node subcommand failed")
	}
	// Default long-running node path. Strip "run"/"start" prefix if present.
	if len(args) > 0 && (args[0] == "run" || args[0] == "start") {
		args = args[1:]
	}
	if err := run(args, logger); err != nil {
		logger.Fatal().Err(err).Msg("aevia provider-node terminated")
	}
}

func run(args []string, logger zerolog.Logger) error {
	cfg, err := config.Parse(args)
	if err != nil {
		return err
	}

	priv, err := identity.LoadOrCreate(cfg.DataDir)
	if err != nil {
		return err
	}

	nc, err := buildNodeConfig(cfg, priv)
	if err != nil {
		return err
	}

	n, err := node.New(nc)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// DHT runs in both modes. Relay Nodes contribute routing without serving
	// content; Provider Nodes contribute routing AND serve content.
	d, err := aeviadht.New(ctx, n.Host(), aeviadht.ModeServer)
	if err != nil {
		return err
	}

	seeds, err := aeviadht.ParseBootstrapPeers(cfg.BootstrapPeers)
	if err != nil {
		return err
	}
	if err := d.Bootstrap(ctx, seeds); err != nil {
		logger.Warn().Err(err).Str("event", "dht_bootstrap_warn").Msg("dht bootstrap incomplete")
	}

	logger.Info().
		Str("event", "node_boot").
		Str("mode", string(cfg.Mode)).
		Str("peer_id", n.PeerID().String()).
		Str("data_dir", cfg.DataDir).
		Str("listen", cfg.Listen).
		Int("bootstrap_seeds", len(seeds)).
		Int("static_relays", len(nc.StaticRelays)).
		Bool("relay_service", nc.EnableRelayService).
		Msg(boot_message(cfg.Mode))

	for _, addr := range n.Host().Addrs() {
		logger.Info().
			Str("event", "listening_libp2p").
			Str("addr", addr.String()+"/p2p/"+n.PeerID().String()).
			Msg("listening on libp2p transport")
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	if cfg.Mode == config.ModeRelay {
		return runRelayLoop(ctx, logger, stop, d, n)
	}
	return runProviderLoop(ctx, cancel, logger, stop, cfg, d, n)
}

func runProviderLoop(ctx context.Context, cancel context.CancelFunc, logger zerolog.Logger, stop <-chan os.Signal, cfg config.Config, d *aeviadht.DHT, n *node.Node) error {
	pinPath := filepath.Join(cfg.DataDir, "pinning")
	pinStore, err := storage.Open(storage.Options{Path: pinPath, Silent: true})
	if err != nil {
		return err
	}
	defer pinStore.Close()

	cs := pinning.NewContentStore(pinStore)

	// Announce every already-pinned CID via the DHT. Keeps the network
	// convergent with whatever the operator has on disk, regardless of
	// when the node last booted.
	pinned, err := cs.List()
	if err != nil {
		return err
	}
	pinCount, bytesUsed, _ := cs.Usage()
	logger.Info().
		Int("pin_count", pinCount).
		Uint64("bytes_used", bytesUsed).
		Int("cids_to_announce", len(pinned)).
		Str("event", "pin_store_loaded").
		Msg("loaded persistent pin set")
	if len(pinned) > 0 {
		go d.RefreshLoop(ctx, pinned, aeviadht.DefaultRefreshPeriod)
	}

	srv := httpx.NewServer(n.Host())
	content.NewHandlers().WithSource(cs).Register(srv)

	tcpListener, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return err
	}

	tcpErr := make(chan error, 1)
	libp2pErr := make(chan error, 1)
	go func() { tcpErr <- srv.ServeHTTPOn(ctx, tcpListener) }()
	go func() { libp2pErr <- srv.ServeLibp2p(ctx) }()

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

func runRelayLoop(ctx context.Context, logger zerolog.Logger, stop <-chan os.Signal, d *aeviadht.DHT, n *node.Node) error {
	logger.Info().Str("event", "relay_mode_active").Msg("relay mode active — no content handlers registered")

	select {
	case <-stop:
		logger.Info().Str("event", "shutdown_signal").Msg("shutdown signal received")
	case <-ctx.Done():
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

func boot_message(mode config.Mode) string {
	if mode == config.ModeRelay {
		return "relay-node started"
	}
	return "provider-node started"
}
