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
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/libp2p/go-libp2p/core/peer"
	webrtc "github.com/pion/webrtc/v4"
	"github.com/rs/zerolog"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/config"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/dhtproxy"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/identity"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/logging"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/mesh"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/mirror"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/node"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/sessioncid"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/tlsauto"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/whep"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
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

	// WHIP ingest + HLS live routing. Creators POST SDP to /whip; the
	// CMAFSegmenter pipes fMP4 segments into LivePinSink (which pins
	// each finalised segment via the pinning.ContentStore). LiveRouter
	// serves /live/{id}/playlist.m3u8 + init.mp4 + segment/{n}.
	//
	// Constructed BEFORE httpx.NewServer so we can plumb the instance
	// into /healthz (active_sessions) and /mirrors/candidates (load
	// term) via ServerOptions. Handlers register onto the mux later
	// via whipSrv.Register(srv).
	whipSrv, err := whip.NewServer(whip.Options{
		AuthorisedDIDs:    splitCSV(cfg.AllowedDIDs),
		PublicIPs:         splitCSV(cfg.PublicIPs),
		RequireSignatures: cfg.RequireSignatures,
	})
	if err != nil {
		return err
	}
	liveRouter := whip.NewLiveRouter()
	whipLog := logger.With().Str("component", "whip").Logger()

	// Fase 3.1 mesh wiring. Every live session this provider hosts
	// joins the `aevia-live-{sessionID}` GossipSub topic so browser
	// viewers that dial this provider via WSS see the provider's
	// subscription and register it in their topic-peer count. Without
	// this, the viewer-side chip reads "0 na sala" regardless of how
	// many viewers connected — prod regression 2026-04-19.
	meshSvc, err := mesh.New(ctx, n.Host())
	if err != nil {
		return err
	}

	httpxOpts := []httpx.ServerOption{
		httpx.WithActiveSessionCounter(whipSrv),
	}
	if cfg.Region != "" {
		httpxOpts = append(httpxOpts, httpx.WithRegion(cfg.Region))
	}
	if cfg.GeoSet {
		httpxOpts = append(httpxOpts, httpx.WithGeo(cfg.GeoLat, cfg.GeoLng))
	}

	// Mirror wiring (Fase 2.1) — bidirectional.
	// Server side: accept inbound mirror streams from other origins,
	// inject whip.Sessions locally so /whep viewers can subscribe,
	// announce the sessionCID so the DHT resolve also points here.
	// Client side: when OUR WHIP session starts, fan out RTP packets
	// to each configured downstream mirror peer.
	//
	// Empty AEVIA_MIRROR_PEERS disables the client without disabling
	// the server — any node can be a mirror endpoint regardless of
	// whether it also replicates its own sessions.
	// Fase 2.2e: "AUTO" literal normalises to empty — both mean
	// dynamic selection (spec §8). Non-empty non-AUTO values are
	// legacy static CSV and emit a WARN on boot to nudge operators
	// toward the dynamic path.
	rawMirrorPeers := cfg.MirrorPeers
	if strings.EqualFold(strings.TrimSpace(rawMirrorPeers), "AUTO") {
		rawMirrorPeers = ""
	}
	mirrorPeers, mirrorPeersErrs := parseMirrorPeers(rawMirrorPeers)
	for _, perr := range mirrorPeersErrs {
		logger.Warn().Err(perr).Str("event", "mirror_peer_parse_failed").Msg("skipping invalid mirror peer id")
	}
	if len(mirrorPeers) > 0 {
		logger.Warn().
			Str("event", "mirror_static_csv_deprecated").
			Int("peer_count", len(mirrorPeers)).
			Msg("AEVIA_MIRROR_PEERS static CSV is deprecated — unset or use AUTO for dynamic selection (spec §8)")
	}
	mirrorLog := logger.With().Str("component", "mirror").Logger()
	// mirror package uses slog; we pass nil so it picks slog.Default().
	// Full structured events still land via mirrorLog (zerolog) inside
	// the OnSession / OnClose callbacks we wire below.
	mirrorSrv, err := mirror.NewServer(n.Host(), whipSrv, nil)
	if err != nil {
		return err
	}
	mirrorSrv.OnSession = func(sess *whip.Session) {
		// Mirror got a fan-out stream from an origin. Announce the
		// sessionCID so viewers doing /dht/resolve can discover that
		// THIS node also serves the stream — same CID, different peerID.
		go func() {
			announceCid, cerr := sessioncid.Of(sess.ID)
			if cerr != nil {
				mirrorLog.Warn().Err(cerr).Str("event", "mirror_session_cid_failed").Str("session_id", sess.ID).Msg("derive session cid")
				return
			}
			actx, acancel := context.WithTimeout(ctx, 30*time.Second)
			defer acancel()
			if aerr := d.Provide(actx, announceCid); aerr != nil {
				mirrorLog.Warn().Err(aerr).Str("event", "mirror_session_announce_failed").Str("session_id", sess.ID).Str("cid", announceCid).Msg("dht provide mirror session")
				return
			}
			mirrorLog.Info().Str("event", "mirror_session_announced").Str("session_id", sess.ID).Str("cid", announceCid).Msg("mirror session announced in DHT")
		}()
	}
	mirrorSrv.OnClose = func(sessionID string, m *mirror.HopMetrics) {
		mirrorLog.Info().
			Str("event", "mirror_session_stats").
			Str("session_id", sessionID).
			Int("video_pkts", m.VideoCount()).
			Int("audio_pkts", m.AudioCount()).
			Int64("hop_p50_ns", m.P50Nanos()).
			Int64("hop_p95_ns", m.P95Nanos()).
			Int64("hop_p99_ns", m.P99Nanos()).
			Msg("mirror session closed")
	}
	mirrorSrv.Start(ctx)

	mirrorClient, err := mirror.NewClient(n.Host(), mirrorPeers, nil, mirror.ClientOptions{})
	if err != nil {
		return err
	}
	if len(mirrorPeers) > 0 {
		ids := make([]string, 0, len(mirrorPeers))
		for _, p := range mirrorPeers {
			ids = append(ids, p.String())
		}
		mirrorLog.Info().Strs("peers", ids).Str("event", "mirror_client_ready").Msgf("origin will fan out to %d mirror(s)", len(mirrorPeers))
	}

	// Fase 2.2b + 2.2c — hook mirror ranker into /mirrors/candidates
	// AND a dynamic selector into OnSession. Two paths:
	//
	//   AEVIA_MIRROR_PEERS non-empty (static mode):
	//     — StartMirroring uses the exact CSV, ranker is merely
	//       informational via /mirrors/candidates.
	//   AEVIA_MIRROR_PEERS empty (dynamic mode):
	//     — PoolFetcher queries /healthz of libp2p-connected peers,
	//       ranker picks top-K per session, StartMirroringWithPeers
	//       opens streams to those peers.
	// Fase 2.2e — env-driven coefficient overrides (spec §5.2.2).
	// Zero-valued cfg fields preserve DefaultWeights.
	rankerWeights := mirror.DefaultWeights()
	if cfg.MirrorRankAlpha != 0 {
		rankerWeights.Alpha = cfg.MirrorRankAlpha
	}
	if cfg.MirrorRankBeta != 0 {
		rankerWeights.Beta = cfg.MirrorRankBeta
	}
	if cfg.MirrorRankGamma != 0 {
		rankerWeights.Gamma = cfg.MirrorRankGamma
	}
	ranker := mirror.NewRanker(rankerWeights, cfg.Region, cfg.GeoLat, cfg.GeoLng, cfg.GeoSet)
	staticPool := make([]mirror.Candidate, 0, len(mirrorPeers))
	for _, p := range mirrorPeers {
		staticPool = append(staticPool, mirror.Candidate{PeerID: p.String()})
	}
	// PoolFetcher enriches static pool with libp2p-live peers, queries
	// each peer's /healthz to populate region + geo + active_sessions.
	// TTL cache 60s keeps probe volume bounded.
	poolFetcher := mirror.NewPoolFetcher(mirror.PoolFetcherConfig{
		Host:       n.Host(),
		StaticSeed: mirrorPeers,
	})
	rankerAdapter := mirror.NewRankerAdapter(mirror.RankerAdapterConfig{
		Client:      mirrorClient,
		Ranker:      ranker,
		StaticPool:  staticPool,
		PoolFetcher: poolFetcher.AsPoolFunc(),
	})
	httpxOpts = append(httpxOpts, httpx.WithMirrorRanker(rankerAdapter))

	// dynamicMode drives the OnSession branch below — picked once at
	// boot so the behaviour per WHIP session is stable.
	dynamicMode := len(mirrorPeers) == 0
	if dynamicMode {
		mirrorLog.Info().
			Str("event", "mirror_mode_dynamic").
			Msg("AEVIA_MIRROR_PEERS empty — top-K picked per session from libp2p peers")
	}

	// Now that all httpx options are accumulated, build the server.
	srv := httpx.NewServer(n.Host(), httpxOpts...)
	content.NewHandlers().WithSource(cs).Register(srv)

	whipSrv.OnSession(func(sess *whip.Session) {
		sink, err := whip.NewLivePinSink(cs, sess.ID)
		if err != nil {
			whipLog.Error().Err(err).Str("event", "live_sink_init_failed").Str("session_id", sess.ID).Msg("live sink init failed")
			return
		}
		seg, err := whip.NewCMAFSegmenter(sink)
		if err != nil {
			whipLog.Error().Err(err).Str("event", "live_segmenter_init_failed").Str("session_id", sess.ID).Msg("live segmenter init failed")
			return
		}
		if err := liveRouter.AttachSession(sess.ID, sink); err != nil {
			whipLog.Error().Err(err).Str("event", "live_router_attach_failed").Str("session_id", sess.ID).Msg("live router attach failed")
			return
		}
		if err := meshSvc.JoinSession(sess.ID); err != nil {
			// Non-fatal — live stream still serves WHEP/HLS. Only the
			// viewer-side P2P chip loses its "N na sala" count.
			whipLog.Warn().Err(err).Str("event", "live_mesh_join_failed").Str("session_id", sess.ID).Msg("mesh topic join failed")
		}
		sess.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
			// Build a per-codec fan-out hub so WHEP viewers attach to
			// the same RTP stream our CMAF segmenter consumes. See
			// internal/whep/whep.go — viewers AddTrack(hub) and pion
			// forwards every packet we write with SSRC rewrite.
			if _, herr := sess.EnsureHubFor(track); herr != nil {
				whipLog.Warn().Err(herr).
					Str("event", "live_hub_init_failed").
					Str("session_id", sess.ID).
					Str("kind", track.Kind().String()).
					Msg("failed to build SFU hub; WHEP viewers won't see this track")
			}
			go func() {
				// TeeReadSessionTrack pipes RTP into both the hub (for
				// WHEP viewers) and every RTPSink attached by the mirror
				// client (for cross-node replication). Sinks are only
				// registered when --mirror-peers is non-empty.
				if err := whip.TeeReadSessionTrack(track, sess, seg); err != nil {
					whipLog.Warn().Err(err).Str("event", "live_track_eof").Str("session_id", sess.ID).Msg("track pump ended")
				}
			}()
		})
		// Start replicating this session to mirror peers. Codec caps
		// match whip.Server MediaEngine (H.264 Constrained Baseline + Opus).
		videoCap := webrtc.RTPCodecCapability{
			MimeType:    webrtc.MimeTypeH264,
			ClockRate:   90_000,
			SDPFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
		}
		audioCap := webrtc.RTPCodecCapability{
			MimeType:  webrtc.MimeTypeOpus,
			ClockRate: 48_000,
			Channels:  2,
		}
		var mirrorsStarted int
		var mirrorMode string
		if dynamicMode {
			// Fase 2.2c + 2.2e — pick top-K peers per session via ranker.
			// K configurable via --mirror-fanout-k / AEVIA_MIRROR_FANOUT_K
			// (spec §5.3, default 3). Viewer hint stays empty for now
			// (creator-side hint is separate scope); ranker falls back
			// to origin region.
			fanoutK := cfg.MirrorFanoutK
			if fanoutK <= 0 {
				fanoutK = 3
			}
			topK := rankerAdapter.SelectTopK(ctx, mirror.ViewerHint{}, fanoutK)
			mirrorMode = "dynamic"
			mirrorsStarted = mirrorClient.StartMirroringWithPeers(ctx, sess, topK, videoCap, audioCap)
			mirrorLog.Info().
				Int("candidates", len(topK)).
				Int("mirrors", mirrorsStarted).
				Str("session_id", sess.ID).
				Str("event", "mirror_fanout_started").
				Str("mode", mirrorMode).
				Msg("origin replicating via dynamic top-K selection")
		} else {
			mirrorsStarted = mirrorClient.StartMirroring(ctx, sess, videoCap, audioCap)
			mirrorMode = "static"
			if mirrorsStarted > 0 {
				mirrorLog.Info().
					Int("mirrors", mirrorsStarted).
					Str("session_id", sess.ID).
					Str("event", "mirror_fanout_started").
					Str("mode", mirrorMode).
					Msg("origin replicating via static CSV")
			}
		}
		// Announce this live session in the DHT so viewers querying any
		// Aevia node via /dht/resolve can discover which provider holds
		// the stream. Without this the viewer is forced to a hardcoded
		// hub URL — exactly the SPOF the Kademlia layer is meant to
		// eliminate. Done in a bounded-ctx goroutine so a slow announce
		// never blocks the SDP answer.
		go func() {
			announceCid, err := sessioncid.Of(sess.ID)
			if err != nil {
				whipLog.Warn().Err(err).Str("event", "session_cid_failed").Str("session_id", sess.ID).Msg("derive session cid")
				return
			}
			actx, acancel := context.WithTimeout(ctx, 30*time.Second)
			defer acancel()
			if err := d.Provide(actx, announceCid); err != nil {
				whipLog.Warn().Err(err).
					Str("event", "session_announce_failed").
					Str("session_id", sess.ID).
					Str("cid", announceCid).
					Msg("dht provide failed — session not discoverable via /dht/resolve")
				return
			}
			whipLog.Info().
				Str("event", "session_announced").
				Str("session_id", sess.ID).
				Str("cid", announceCid).
				Msg("live session announced in DHT")
		}()

		go func() {
			<-sess.Done()
			if err := seg.Close(); err != nil {
				whipLog.Warn().Err(err).Str("event", "live_segmenter_close").Str("session_id", sess.ID).Msg("segmenter close")
			}
			// Pin the final manifest so the VOD endpoint (manifest.json
			// + EXT-X-ENDLIST playlist) becomes available. Idempotent
			// if CMAFSegmenter.Close already drove Finalize.
			finalManifest, err := sink.Finalize(whip.TargetSegmentDuration)
			if err != nil {
				whipLog.Warn().Err(err).
					Str("event", "live_finalize_failed").
					Str("session_id", sess.ID).
					Msg("finalize manifest")
			} else if finalManifest != nil {
				// Announce the manifest CID so viewers post-live can
				// discover the replay via /dht/resolve — same pattern as
				// the live-session announce but using the cryptographic
				// manifest CID rather than the session-derived CID.
				go func(cidStr string) {
					actx, acancel := context.WithTimeout(ctx, 30*time.Second)
					defer acancel()
					if err := d.Provide(actx, cidStr); err != nil {
						whipLog.Warn().Err(err).
							Str("event", "manifest_announce_failed").
							Str("session_id", sess.ID).
							Str("cid", cidStr).
							Msg("dht provide manifest")
						return
					}
					whipLog.Info().
						Str("event", "manifest_announced").
						Str("session_id", sess.ID).
						Str("cid", cidStr).
						Msg("VOD manifest announced in DHT")
				}(finalManifest.CID)
			}
			// NOTE: we deliberately keep the session attached to the
			// LiveRouter after Close so viewers arriving late can still
			// fetch manifest.json + playlist.m3u8 + segments. Eviction
			// policy (e.g., TTL based on endedAt, or disk-space cap)
			// lands with the operator tools in a future iteration.
			whipLog.Info().Str("event", "live_session_ended").Str("session_id", sess.ID).Msg("live session ended")
		}()
		whipLog.Info().Str("event", "live_session_started").Str("session_id", sess.ID).Msg("live session started")
	})
	whipSrv.Register(srv)
	liveRouter.Register(srv)

	// WHEP egress — viewers POST SDP to /whep/{sessionID} and we fan
	// out the session's RTP stream via pion TrackLocalStaticRTP. Same
	// PublicIPs config as WHIP because viewer PeerConnections face the
	// same NAT constraints.
	whepSrv, err := whep.New(whep.Options{
		WhipServer: whipSrv,
		PublicIPs:  splitCSV(cfg.PublicIPs),
	})
	if err != nil {
		return err
	}
	whepSrv.Register(srv)

	// /dht/resolve lets Provider-mode nodes double as DHT proxies for
	// browser clients. Harmless on a Provider NAT and unlocks WHEP wiring
	// without an extra Relay hop.
	dhtProxy, err := dhtproxy.New(dhtproxy.AdaptDHT(d))
	if err != nil {
		return err
	}
	dhtProxy.Register(srv)

	tcpListener, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return err
	}

	tcpErr := make(chan error, 1)
	libp2pErr := make(chan error, 1)
	go func() { tcpErr <- srv.ServeHTTPOn(ctx, tcpListener) }()
	go func() { libp2pErr <- srv.ServeLibp2p(ctx) }()

	// Optional HTTPS transport. When TLS is configured, we serve the
	// same mux on :443 (or cfg.TLSAddr) with a Let's Encrypt cert
	// obtained via Cloudflare DNS-01. Browsers coming from
	// https://aevia.video can then POST WHIP / GET HLS without the
	// mixed-content block. HTTP :8080 stays up for local dev probes
	// and for relays inside the mesh.
	tlsCfg := tlsauto.Config{
		Domain:             cfg.TLSDomain,
		Email:              cfg.TLSEmail,
		CloudflareAPIToken: cfg.TLSCloudflareAPIToken,
		CacheDir:           cfg.TLSCacheDir,
		Staging:            cfg.TLSStaging,
	}
	tlsErr := make(chan error, 1)
	if tlsCfg.Enabled() {
		mgr, err := tlsauto.New(tlsCfg)
		if err != nil {
			return fmt.Errorf("tls: %w", err)
		}
		logger.Info().
			Str("event", "tls_provisioning").
			Str("domain", tlsCfg.Domain).
			Bool("staging", tlsCfg.Staging).
			Msg("obtaining Let's Encrypt certificate via Cloudflare DNS-01")
		if err := mgr.EnsureCertificate(ctx); err != nil {
			return fmt.Errorf("tls: obtain certificate: %w", err)
		}
		logger.Info().
			Str("event", "tls_ready").
			Str("domain", tlsCfg.Domain).
			Str("addr", tlsListenAddr(cfg.TLSAddr)).
			Msg("HTTPS ready")
		go func() {
			tlsErr <- mgr.ServeHTTPS(ctx, tlsListenAddr(cfg.TLSAddr), srv.Handler())
		}()
	}

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
	case err := <-tlsErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error().Err(err).Str("event", "tls_transport_error").Msg("tls transport error")
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

// tlsListenAddr returns the HTTPS listen address, falling back to
// :443 when the operator didn't override it via --tls-addr.
func tlsListenAddr(addr string) string {
	if addr == "" {
		return ":443"
	}
	return addr
}

// splitCSV trims and splits a comma-separated DID list. Empty input
// yields a nil slice so whip.Options treats it as "auth disabled".
func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// parseMirrorPeers converts a CSV string of libp2p peer IDs to
// []peer.ID. Malformed entries are collected as errors the caller can
// log; the returned slice only contains successfully parsed IDs.
// Multiaddrs are NOT accepted here — we resolve peerIDs against the
// existing host's peerstore / DHT at stream-open time.
func parseMirrorPeers(raw string) ([]peer.ID, []error) {
	items := splitCSV(raw)
	if len(items) == 0 {
		return nil, nil
	}
	peers := make([]peer.ID, 0, len(items))
	var errs []error
	for _, s := range items {
		id, err := peer.Decode(s)
		if err != nil {
			errs = append(errs, fmt.Errorf("parse mirror peer %q: %w", s, err))
			continue
		}
		peers = append(peers, id)
	}
	return peers, errs
}

