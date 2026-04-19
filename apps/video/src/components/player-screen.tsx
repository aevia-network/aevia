'use client';

import { BottomNav } from '@/components/bottom-nav';
import { explorerTxUrl } from '@/lib/chain';
import type { MeshHandle } from '@/lib/mesh/p2p';
import { fetchIceServers } from '@/lib/webrtc/ice';
import { type WhepSession, playWhep } from '@/lib/webrtc/whep';
import {
  type FailoverCandidate,
  type FailoverHandle,
  type FailoverState,
  playWhepWithFailover,
} from '@/lib/webrtc/whep-failover';
import { PermanenceStrip, PresenceRow, ReactionStrip, VigilChip } from '@aevia/ui';
import Hls from 'hls.js';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MoreHorizontal,
  Play,
  Rewind,
  Send,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mirrors Stitch screen `7687d89d09ff44378cad9f532419fc84` ("Aevia — Live
 * Player (Harmonized)"). Composes four of the new signature components:
 * ReactionStrip, PresenceRow, PermanenceStrip, VigilChip.
 *
 * Playback is preserved verbatim from the prior viewer.tsx — WHEP for live,
 * HLS fallback for VOD (via native canPlayType or hls.js), autoplay-gate
 * overlay for iOS Safari, mode-switch from live→replay when broadcaster
 * disconnects. Chrome (top bar, overlays, reactions, chat) is new.
 *
 * Sprint 2 split:
 * - REAL: WHEP/HLS playback, state, live.created, creator address/DID,
 *   manifest CID, register block/tx, title.
 * - MOCK with honest framing: reaction counts, presence row viewers,
 *   chat messages, "+N assistindo" counter. All mocks carry an "amostra ·
 *   sprint 3" tag so nothing passes for production.
 */

type ViewerMode = 'live' | 'vod';
type LiveStatus = 'idle' | 'connecting' | 'playing' | 'ended' | 'error';
type VodStatus = 'idle' | 'loading' | 'playing' | 'error';

export interface PlayerScreenProps {
  uid: string;
  title: string;
  whepUrl: string;
  hlsUrl: string | null;
  /**
   * HLS playlist URL served by an Aevia provider-node (M8 mesh path).
   * ~10s latency, universal browser support. Fallback used when
   * `aeviaWhepUrl` is absent or the WebRTC handshake fails.
   */
  aeviaHlsUrl: string | null;
  /**
   * WHEP URL served by an Aevia provider-node (M8.5 SFU path).
   * When set, playback negotiates a WebRTC PeerConnection directly
   * against the node; latency drops to ~300-500ms. The HLS path above
   * stays as a fallback in case WHEP handshake fails.
   */
  aeviaWhepUrl: string | null;
  /**
   * WHIP sessionID used to construct WHEP URLs on each candidate
   * (Fase 2.3). Same across all candidates by DHT construction —
   * peers announce the same sessionCID, so all `httpsBase/whep/{sessionId}`
   * paths address the same live stream. Required when
   * `aeviaFailoverCandidates` is non-empty.
   */
  aeviaSessionId?: string;
  /**
   * Ordered candidate list for cross-provider failover (Fase 2.3).
   * Typically resolved server-side via `resolveSessionProviders` +
   * ranked by `rankProvidersByRegion`. When non-empty, playback uses
   * the failover orchestrator — falls through to next candidate when
   * the active stream breaks. When empty, legacy single-URL path via
   * `aeviaWhepUrl` wins (keeps existing deployments working).
   */
  aeviaFailoverCandidates?: FailoverCandidate[];
  /**
   * libp2p WSS bootstrap multiaddrs the browser dials to join the
   * session's GossipSub topic (Fase 3.1). Example entry:
   *   /dns4/provider.aevia.network/tcp/443/wss/p2p/12D3Koo...
   * Empty disables the P2P scaffold entirely. When non-empty AND
   * ?p2p=1 is in the URL, the viewer boots a browser libp2p node,
   * joins topic `aevia-live-{sessionId}`, and publishes heartbeats.
   * Bandwidth cost: ~300-400 KB gzipped (dynamically imported).
   */
  aeviaLibp2pBootstraps?: string[];
  vodProcessing?: boolean;
  creatorDisplayName: string;
  creatorAddress: `0x${string}` | null;
  state: string;
  /** ISO8601 timestamp when the live input was created (proxy for "started at"). */
  startedISO: string;
  manifestCid: string | null;
  registerBlock: number | null;
  registerTxHash: string | null;
}

export function PlayerScreen(props: PlayerScreenProps) {
  const initialMode: ViewerMode = props.state === 'connected' ? 'live' : 'vod';
  const [mode, setMode] = useState<ViewerMode>(initialMode);
  const videoRef = useRef<HTMLVideoElement>(null);

  const whepSessionRef = useRef<WhepSession | null>(null);
  const failoverHandleRef = useRef<FailoverHandle | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  // Failover telemetry (Fase 2.3). Exposed via refs so debug builds +
  // future overlay UI can surface "reconectando de peer A → B". No
  // render-driving usage yet; `_` prefix satisfies lint's unused-variable
  // rule while keeping the names self-documenting at the call site.
  const [_failoverState, setFailoverState] = useState<FailoverState>('idle');
  const [_activePeerId, setActivePeerId] = useState<string | null>(null);

  // P2P browser mesh state (Fase 3.1). Lazy-loaded when ?p2p=1.
  const meshHandleRef = useRef<MeshHandle | null>(null);
  const [meshStats, setMeshStats] = useState<{
    connected: number;
    topicPeers: number;
  } | null>(null);

  const [vodStatus, setVodStatus] = useState<VodStatus>('idle');
  const [vodError, setVodError] = useState<string | null>(null);

  // WHEP preference: aevia mesh first (our own SFU, zero Cloudflare),
  // Cloudflare Stream WHEP as the legacy fallback. The HLS.js effect
  // below takes over when both WHEP URLs are unset or WHEP fails.
  const effectiveWhepUrl = props.aeviaWhepUrl ?? (props.whepUrl || null);

  const startLive = useCallback(async () => {
    const debugLog =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1';

    // Fase 2.3 failover path. When page passed a non-empty candidate
    // list AND sessionId, use the orchestrator — viewer re-routes
    // automatically across providers when the active stream breaks.
    // Otherwise fall back to the legacy single-URL playWhep call.
    if (
      props.aeviaFailoverCandidates &&
      props.aeviaFailoverCandidates.length > 0 &&
      props.aeviaSessionId
    ) {
      setLiveStatus('connecting');
      setLiveError(null);
      const handle = playWhepWithFailover({
        sessionId: props.aeviaSessionId,
        candidates: props.aeviaFailoverCandidates,
        debugLog,
        onStateChange: (state, ctx) => {
          setFailoverState(state);
          setActivePeerId(ctx.candidate?.peerId ?? null);
          if (state === 'connecting' || state === 'failing-over') setLiveStatus('connecting');
          if (state === 'connected') setLiveStatus('playing');
          if (state === 'failed-all') {
            setLiveStatus('error');
            setLiveError(`nenhum dos ${ctx.totalAttempts} provedores conseguiu servir a live`);
          }
        },
        onStream: (stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => setAutoplayBlocked(true));
          }
        },
      });
      failoverHandleRef.current = handle;
      return;
    }

    // Legacy single-URL path (current deployments pre-Fase 2.3).
    if (!effectiveWhepUrl) {
      return; // HLS-only path — the other effect drives playback.
    }
    setLiveStatus('connecting');
    setLiveError(null);
    try {
      // Fetch dynamic ICE servers (STUN + Cloudflare TURN credentials when
      // configured server-side). Without TURN, viewers on hostile mobile
      // networks (Vivo 4G CGNAT, corporate firewalls blocking UDP) silently
      // fail the WebRTC handshake. The TURN relay over TCP/443 routes
      // around both. `fetchIceServers` never throws — falls back to the
      // static STUN list on any failure.
      const iceServers = await fetchIceServers();
      const session = await playWhep({
        whepUrl: effectiveWhepUrl,
        iceServers,
        debugLog,
        onConnectionStateChange: (s) => {
          if (s === 'connected') setLiveStatus('playing');
          if (s === 'failed' || s === 'closed') {
            setLiveStatus('error');
            setLiveError(`conexão ${s === 'failed' ? 'falhou' : 'encerrada'}`);
          }
          if (s === 'disconnected') setLiveStatus('ended');
        },
      });
      whepSessionRef.current = session;
      if (videoRef.current) {
        videoRef.current.srcObject = session.stream;
        try {
          await videoRef.current.play();
        } catch {
          // iOS Safari often blocks autoplay until user gesture.
          setAutoplayBlocked(true);
        }
      }
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'falha ao conectar');
      setLiveStatus('error');
    }
  }, [effectiveWhepUrl, props.aeviaFailoverCandidates, props.aeviaSessionId]);

  useEffect(() => {
    if (mode !== 'live') return;
    // When WHEP is available (either aevia-mesh SFU or Cloudflare),
    // startLive drives playback. The HLS.js effect below only kicks in
    // when WHEP isn't available OR fails — it checks effectiveWhepUrl.
    const hasFailover =
      (props.aeviaFailoverCandidates?.length ?? 0) > 0 && Boolean(props.aeviaSessionId);
    if (effectiveWhepUrl || hasFailover) {
      void startLive();
      return () => {
        // Stop both the legacy single-URL session and the failover
        // handle — whichever was active. Both are idempotent.
        void whepSessionRef.current?.stop();
        whepSessionRef.current = null;
        void failoverHandleRef.current?.stop();
        failoverHandleRef.current = null;
      };
    }
  }, [mode, startLive, effectiveWhepUrl, props.aeviaFailoverCandidates, props.aeviaSessionId]);

  // Fase 3.1 P2P browser mesh — opt-in via ?p2p=1 URL param. Dynamic
  // import keeps the ~400 KB libp2p bundle out of the initial page
  // load. When enabled, browser joins GossipSub topic, publishes
  // heartbeats, and renders a debug chip showing peer count. This
  // is pure observability in 3.1 — no video delivery yet; Fase 3.2
  // adds chunk relay + 3.3 adds WebRTC RTP relay viewer-to-viewer.
  useEffect(() => {
    if (mode !== 'live') return;
    if (typeof window === 'undefined') return;
    const p2pEnabled = new URLSearchParams(window.location.search).get('p2p') === '1';
    if (!p2pEnabled) return;
    if (!props.aeviaSessionId) return;
    const bootstraps = props.aeviaLibp2pBootstraps ?? [];
    if (bootstraps.length === 0) return;

    let cancelled = false;
    let statusPoll: ReturnType<typeof setInterval> | undefined;
    void (async () => {
      try {
        const mod = await import('@/lib/mesh/p2p');
        if (cancelled) return;
        const handle = await mod.initMesh({
          sessionId: props.aeviaSessionId as string,
          bootstraps,
          heartbeatIntervalMs: 5_000,
        });
        if (cancelled) {
          await handle.stop();
          return;
        }
        meshHandleRef.current = handle;
        // Poll status every 2s — cheap (reads in-memory counters)
        // and sufficient UX feedback for the debug chip.
        statusPoll = setInterval(() => {
          const s = handle.status();
          setMeshStats({ connected: s.connectedPeerCount, topicPeers: s.topicPeerCount });
        }, 2_000);
        // Immediate first snapshot so the chip renders as soon as
        // libp2p signals ready; the 2s poll refines it afterwards.
        const s0 = handle.status();
        setMeshStats({ connected: s0.connectedPeerCount, topicPeers: s0.topicPeerCount });
      } catch (err) {
        // libp2p boot failures are easy to mask and hard to diagnose
        // later in prod; log via console.error even in prod builds.
        // Main viewing path is unaffected either way (WHEP / HLS own
        // playback).
        console.error('[p2p] init failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (statusPoll) clearInterval(statusPoll);
      void meshHandleRef.current?.stop();
      meshHandleRef.current = null;
      setMeshStats(null);
    };
  }, [mode, props.aeviaSessionId, props.aeviaLibp2pBootstraps]);

  // Aevia-mesh live playback via hls.js — used as fallback when WHEP
  // isn't configured. Keeps the same <video> element WHEP uses so the
  // autoplay gate / states / controls stay unchanged.
  useEffect(() => {
    if (mode !== 'live') return;
    if (effectiveWhepUrl) return; // WHEP path owns playback
    if (!props.aeviaHlsUrl) return;
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = null;
    setLiveStatus('connecting');
    setLiveError(null);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = props.aeviaHlsUrl;
      const onCanPlay = () => {
        setLiveStatus('playing');
        video.play().catch(() => setAutoplayBlocked(true));
      };
      const onError = () => {
        setLiveStatus('error');
        setLiveError('playlist indisponível — transmissão pode ter encerrado');
      };
      video.addEventListener('canplay', onCanPlay, { once: true });
      video.addEventListener('error', onError);
      return () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
        video.src = '';
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        // Live tuning — keep the manifest fresh and the buffer small so
        // we chase the head of the playlist as the provider pins new
        // segments. Defaults target VOD.
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 6,
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 1_500,
      });
      hls.loadSource(props.aeviaHlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLiveStatus('playing');
        video.play().catch(() => setAutoplayBlocked(true));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setLiveError(`mesh: ${data.type}`);
          setLiveStatus('error');
        }
      });
      return () => {
        hls.destroy();
      };
    }

    setLiveError('navegador não suporta HLS');
    setLiveStatus('error');
  }, [mode, props.aeviaHlsUrl, effectiveWhepUrl]);

  // ---- Auto-handoff live → VOD when broadcaster ends transmission ---------
  // The WHEP `disconnected` callback already flips `liveStatus` to `'ended'`
  // (line ~85). Two follow-ups need to happen automatically without a tap:
  //
  // 1. If the server already has the recording's HLS URL (broadcaster's tab
  //    finished the tus upload before the viewer noticed), swap mode after a
  //    short beat so the viewer perceives "encerrou → assistir replay" as a
  //    natural transition rather than a flash.
  //
  // 2. If the recording is still uploading/processing, poll the page via
  //    Router.refresh() every 5 s up to 2 minutes. The server component
  //    re-fetches `getVideo()` (already live in `live/[id]/page.tsx`) and
  //    once `hlsUrl` arrives as a fresh prop the auto-switch from (1) fires.
  //    Polling also covers the "user opens the page mid-processing" path
  //    (`mode === 'vod' && vodProcessing`).
  const router = useRouter();
  const pollTickRef = useRef(0);
  const [pollRemaining, setPollRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Auto-switch when the server has already linked the recording.
    if (liveStatus !== 'ended') return;
    if (!props.hlsUrl) return;
    if (mode !== 'live') return;
    const t = setTimeout(() => {
      void whepSessionRef.current?.stop();
      whepSessionRef.current = null;
      setMode('vod');
    }, 800);
    return () => clearTimeout(t);
  }, [liveStatus, props.hlsUrl, mode]);

  useEffect(() => {
    // Poll for VOD readiness — fires only while we're waiting on Cloudflare.
    const waitingPostLive = liveStatus === 'ended' && !props.hlsUrl;
    const openedDuringProcessing =
      mode === 'vod' && (props.vodProcessing ?? false) && !props.hlsUrl;
    if (!waitingPostLive && !openedDuringProcessing) {
      pollTickRef.current = 0;
      setPollRemaining(null);
      return;
    }

    const MAX_TICKS = 24; // 24 × 5 s = 2 min total
    const INTERVAL_MS = 5_000;
    setPollRemaining(MAX_TICKS - pollTickRef.current);

    const id = setInterval(() => {
      pollTickRef.current += 1;
      if (pollTickRef.current >= MAX_TICKS) {
        clearInterval(id);
        setPollRemaining(0);
        return;
      }
      setPollRemaining(MAX_TICKS - pollTickRef.current);
      router.refresh();
    }, INTERVAL_MS);

    return () => clearInterval(id);
  }, [liveStatus, mode, props.hlsUrl, props.vodProcessing, router]);

  useEffect(() => {
    if (mode !== 'vod' || !props.hlsUrl) return;
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = null;
    setVodStatus('loading');
    setVodError(null);

    const onError = () => {
      setVodError('falha ao carregar replay');
      setVodStatus('error');
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = props.hlsUrl;
      const onCanPlay = () => setVodStatus('playing');
      video.addEventListener('canplay', onCanPlay, { once: true });
      video.addEventListener('error', onError);
      return () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
        video.src = '';
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hls.loadSource(props.hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setVodStatus('playing');
        video.play().catch(() => setAutoplayBlocked(true));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setVodError(`replay error: ${data.type}`);
          setVodStatus('error');
        }
      });
      return () => {
        hls.destroy();
      };
    }

    setVodError('reprodução hls não suportada neste navegador');
    setVodStatus('error');
  }, [mode, props.hlsUrl]);

  const unmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      void videoRef.current.play();
      setAutoplayBlocked(false);
    }
  };

  const switchToReplay = () => {
    void whepSessionRef.current?.stop();
    whepSessionRef.current = null;
    setMode('vod');
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/live/${props.uid}`;
    const shareData = { title: `${props.title} · aevia`, url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    await navigator.clipboard?.writeText(url);
  };

  const isLivePlaying = mode === 'live' && liveStatus === 'playing';
  const isVodPlaying = mode === 'vod' && vodStatus === 'playing';
  const elapsedLabel = useElapsedSince(props.startedISO);

  return (
    <div className="min-h-screen pb-28">
      <TopChrome
        creatorDisplayName={props.creatorDisplayName}
        creatorAddress={props.creatorAddress}
        onShare={handleShare}
      />

      <main className="mx-auto max-w-2xl">
        <PlayerFrame
          videoRef={videoRef}
          mode={mode}
          liveStatus={liveStatus}
          vodStatus={vodStatus}
          elapsedLabel={elapsedLabel}
          autoplayBlocked={autoplayBlocked}
          onUnmute={unmute}
          meshStats={meshStats}
        />

        <div className="flex flex-col gap-6 px-4 pt-5">
          <PlaybackStatusRow
            mode={mode}
            liveStatus={liveStatus}
            liveError={liveError}
            vodError={vodError}
            hlsUrl={props.hlsUrl}
            vodProcessing={props.vodProcessing ?? false}
            pollRemaining={pollRemaining}
            onRetryLive={startLive}
            onSwitchToReplay={switchToReplay}
            isLivePlaying={isLivePlaying}
            isVodPlaying={isVodPlaying}
          />

          <TitleBlock
            title={props.title}
            creatorDisplayName={props.creatorDisplayName}
            creatorAddress={props.creatorAddress}
            startedISO={props.startedISO}
            isLive={isLivePlaying}
          />

          <DescriptionBlock />

          <PermanenceBlock
            isLive={isLivePlaying || isVodPlaying}
            manifestCid={props.manifestCid}
            registerBlock={props.registerBlock}
            registerTxHash={props.registerTxHash}
          />

          <section aria-labelledby="reactions-heading" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="reactions-heading"
                className="font-headline font-semibold text-base text-on-surface lowercase"
              >
                reações
              </h2>
              <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
                amostra · sprint 3
              </span>
            </div>
            <ReactionStrip counts={MOCK_REACTION_COUNTS} className="flex-wrap" />
          </section>

          <ChatBlock />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

// ---- Helpers -------------------------------------------------------------

function formatTimeSince(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'começou agora';
  if (mins < 60) return `começou há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `começou há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

/**
 * React-friendly variant: returns an empty string on the first server render
 * so the SSR HTML matches CSR (avoids React hydration warnings caused by
 * `Date.now()`-based labels), then populates the real value after mount and
 * refreshes every minute so the elapsed time stays accurate.
 */
function useElapsedSince(iso: string): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    setLabel(formatTimeSince(iso));
    const id = setInterval(() => setLabel(formatTimeSince(iso)), 60_000);
    return () => clearInterval(id);
  }, [iso]);
  return label;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return (first + last).toUpperCase();
}

// ---- Top chrome ----------------------------------------------------------

function TopChrome({
  creatorDisplayName,
  creatorAddress,
  onShare,
}: {
  creatorDisplayName: string;
  creatorAddress: `0x${string}` | null;
  onShare: () => void;
}) {
  const creatorHref = creatorAddress ? `/creator/${creatorAddress}` : '/discover';
  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center bg-[#1C2027]/65 px-4 backdrop-blur-[20px]">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/feed"
            aria-label="voltar"
            className="rounded-full p-1.5 text-on-surface transition-colors hover:bg-surface-container"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <Link
            href={creatorHref}
            className="flex items-center gap-2 rounded-full bg-surface-container py-1 pr-3 pl-1 transition-colors hover:bg-surface-high"
          >
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-container font-label font-semibold text-[11px] text-on-primary">
              {initials(creatorDisplayName)}
            </span>
            <span className="font-body font-medium text-on-surface text-sm lowercase">
              {creatorDisplayName}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="compartilhar"
            onClick={onShare}
            className="rounded-full p-2 text-on-surface/70 transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Share2 className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="mais opções"
            className="rounded-full p-2 text-on-surface/70 transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

// ---- Player frame with overlays -----------------------------------------

function PlayerFrame({
  videoRef,
  mode,
  liveStatus,
  vodStatus,
  elapsedLabel,
  autoplayBlocked,
  onUnmute,
  meshStats,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mode: ViewerMode;
  liveStatus: LiveStatus;
  vodStatus: VodStatus;
  elapsedLabel: string;
  autoplayBlocked: boolean;
  onUnmute: () => void;
  meshStats: { connected: number; topicPeers: number } | null;
}) {
  const isLivePlaying = mode === 'live' && liveStatus === 'playing';
  const isVodPlaying = mode === 'vod' && vodStatus === 'playing';
  const isIdleBuffering =
    (mode === 'live' && (liveStatus === 'idle' || liveStatus === 'connecting')) ||
    (mode === 'vod' && (vodStatus === 'idle' || vodStatus === 'loading'));

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-surface-high">
      {/* Native controls render in both live and vod. We start `muted` so
          autoplay survives Chrome/Safari policies; the controls let the
          viewer unmute on first interaction. For live MediaStream the
          browser hides seek (no duration), so the live UX collapses to
          play/pause + volume — exactly what the viewer needs. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls
        className="h-full w-full object-contain"
      />

      {/* Live chip with elapsed time — top-left */}
      {isLivePlaying && (
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-sm bg-black/80 px-2 py-1 font-label text-[10px] text-white uppercase tracking-wider">
          <span aria-hidden className="aevia-live-pulse size-1.5 rounded-full" />
          ao vivo · {elapsedLabel.replace('começou há ', '')}
        </span>
      )}

      {/* Viewer count chip — top-right, mock */}
      {(isLivePlaying || isVodPlaying) && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-sm bg-black/60 px-2 py-1 font-label text-[10px] text-white lowercase">
          + 298 assistindo · amostra
        </span>
      )}

      {/* Fase 3.1 — P2P mesh debug chip (only when ?p2p=1 + mesh active). */}
      {meshStats && (
        <span className="absolute top-10 right-3 inline-flex items-center gap-1.5 rounded-sm bg-primary/30 px-2 py-1 font-label font-medium text-[10px] text-white lowercase">
          p2p · {meshStats.connected} conectado · {meshStats.topicPeers} na sala
        </span>
      )}

      {/* Presence row — bottom-left, mock */}
      {(isLivePlaying || isVodPlaying) && (
        <div className="absolute bottom-3 left-3">
          <PresenceRow viewers={MOCK_PRESENCE} total={22} className="[&>*]:text-white" />
        </div>
      )}

      {/* Autoplay gate */}
      {autoplayBlocked && (
        <button
          type="button"
          onClick={onUnmute}
          className="absolute inset-0 flex items-center justify-center bg-background/80 font-headline font-medium text-lg text-on-surface lowercase"
        >
          toque para ativar o som
        </button>
      )}

      {/* Idle / buffering state */}
      {isIdleBuffering && !autoplayBlocked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-black/60">
            <Play className="size-7 text-white" aria-hidden />
          </span>
        </div>
      )}
    </div>
  );
}

// ---- Playback status row -------------------------------------------------

function PlaybackStatusRow({
  mode,
  liveStatus,
  liveError,
  vodError,
  hlsUrl,
  vodProcessing,
  pollRemaining,
  onRetryLive,
  onSwitchToReplay,
  isLivePlaying,
  isVodPlaying,
}: {
  mode: ViewerMode;
  liveStatus: LiveStatus;
  liveError: string | null;
  vodError: string | null;
  hlsUrl: string | null;
  vodProcessing: boolean;
  /** Ticks remaining in the auto-poll loop (5 s each). Null when not polling. */
  pollRemaining: number | null;
  onRetryLive: () => void;
  onSwitchToReplay: () => void;
  isLivePlaying: boolean;
  isVodPlaying: boolean;
}) {
  if (isLivePlaying || isVodPlaying) return null;

  // Live ended + HLS already available — auto-switch effect runs in 800 ms.
  // Render the manual button as a graceful fallback in case the timer is
  // pre-empted by an unmount/remount race or the user wants to skip the wait.
  if (mode === 'live' && liveStatus === 'ended' && hlsUrl) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-container p-4 font-body text-on-surface/80 text-sm lowercase">
        <span className="size-1.5 animate-pulse rounded-full bg-primary-dim" />
        transmissão encerrada · abrindo replay…
        <button
          type="button"
          onClick={onSwitchToReplay}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-label text-on-primary text-xs lowercase"
        >
          <Rewind className="size-3.5" aria-hidden />
          agora
        </button>
      </div>
    );
  }

  // Live ended but VOD not yet linked. Auto-poll is running; render countdown.
  if (mode === 'live' && liveStatus === 'ended' && !hlsUrl) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-container p-4 font-body text-on-surface/70 text-sm lowercase">
        <span className="size-1.5 animate-pulse rounded-full bg-secondary" />
        transmissão encerrada · processando replay
        {pollRemaining !== null && pollRemaining > 0 && (
          <span className="font-mono text-[10px] text-on-surface/40">
            próxima checagem em ≤ 5 s · {pollRemaining} restantes
          </span>
        )}
        {pollRemaining === 0 && (
          <span className="font-mono text-[10px] text-on-surface/40">
            replay ainda não disponível — recarregue em alguns minutos
          </span>
        )}
      </div>
    );
  }

  if (mode === 'live' && liveError) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-container p-4 font-body text-danger text-sm lowercase">
        erro: {liveError}
        <button
          type="button"
          onClick={onRetryLive}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-high px-3 py-1.5 font-label text-on-surface text-xs lowercase"
        >
          tentar novamente
        </button>
      </div>
    );
  }

  if (mode === 'vod' && vodError) {
    return (
      <div className="rounded-md bg-surface-container p-4 font-body text-danger text-sm lowercase">
        erro: {vodError}
      </div>
    );
  }

  // Opened the page mid-processing — same auto-poll, different copy.
  if (mode === 'vod' && !hlsUrl && vodProcessing) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-container p-4 font-body text-on-surface/70 text-sm lowercase">
        <span className="size-1.5 animate-pulse rounded-full bg-secondary" />
        gravação sendo processada pelo cloudflare
        {pollRemaining !== null && pollRemaining > 0 && (
          <span className="font-mono text-[10px] text-on-surface/40">
            próxima checagem em ≤ 5 s · {pollRemaining} restantes
          </span>
        )}
        {pollRemaining === 0 && (
          <span className="font-mono text-[10px] text-on-surface/40">
            ainda processando — recarregue em alguns minutos
          </span>
        )}
      </div>
    );
  }

  if (mode === 'vod' && !hlsUrl && !vodProcessing) {
    return (
      <div className="rounded-md bg-surface-container p-4 font-body text-on-surface/70 text-sm lowercase">
        nenhuma gravação disponível para esta transmissão.
      </div>
    );
  }

  return null;
}

// ---- Title + byline ------------------------------------------------------

function TitleBlock({
  title,
  creatorDisplayName,
  creatorAddress,
  startedISO,
  isLive,
}: {
  title: string;
  creatorDisplayName: string;
  creatorAddress: `0x${string}` | null;
  startedISO: string;
  isLive: boolean;
}) {
  const creatorHref = creatorAddress ? `/creator/${creatorAddress}` : '/discover';
  const elapsed = useElapsedSince(startedISO);
  return (
    <section aria-labelledby="player-title" className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <h1
          id="player-title"
          className="flex-1 font-headline font-semibold text-[22px] text-on-surface leading-tight lowercase"
        >
          {title}
        </h1>
        {isLive && <VigilChip />}
      </div>
      <p className="font-label text-[11px] text-on-surface/60 lowercase">
        <Link href={creatorHref} className="hover:text-on-surface">
          {creatorDisplayName}
        </Link>
        <span aria-hidden> · </span>
        {isLive ? elapsed : 'replay'}
      </p>
    </section>
  );
}

// ---- Description (mock, honest) -----------------------------------------

function DescriptionBlock() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section aria-label="descrição" className="flex flex-col gap-2">
      <p className={`font-body text-on-surface/80 text-sm ${expanded ? '' : 'line-clamp-2'}`}>
        descrição da transmissão ainda não disponível na interface — os criadores poderão editar
        título e descrição antes de ir ao ar na sprint 3. por ora mostramos o título cadastrado no
        cloudflare stream. o resumo completo, capítulos e transcrição automática virão junto com o
        pipeline de processamento em batch.
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 self-start font-label text-on-surface/60 text-xs lowercase hover:text-on-surface"
      >
        {expanded ? 'recolher' : 'ler mais'}
        {expanded ? (
          <ChevronUp className="size-3.5" aria-hidden />
        ) : (
          <ChevronDown className="size-3.5" aria-hidden />
        )}
      </button>
    </section>
  );
}

// ---- Permanence receipt --------------------------------------------------

function PermanenceBlock({
  isLive,
  manifestCid,
  registerBlock,
  registerTxHash,
}: {
  isLive: boolean;
  manifestCid: string | null;
  registerBlock: number | null;
  registerTxHash: string | null;
}) {
  const layers = isLive ? (['providers', 'edge'] as const) : (['edge'] as const);
  const label = isLive ? 'edge + provider nodes' : 'edge gateway (hls)';
  const anchored = Boolean(manifestCid && registerBlock && registerTxHash);

  return (
    <section
      aria-label="permanência"
      className="flex flex-col gap-3 rounded-md bg-surface-container p-4"
    >
      <div className="flex items-center gap-3">
        <PermanenceStrip layers={layers} width={96} aria-label={`persistência: ${label}`} />
        <p className="font-label text-[11px] text-on-surface/70 lowercase">persistência: {label}</p>
      </div>

      {anchored ? (
        <div className="flex flex-col gap-1 border-outline-variant/30 border-t pt-3 font-mono text-[10px] text-on-surface/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="uppercase tracking-wider">manifesto</span>
            <code className="truncate">cid: {manifestCid?.slice(0, 18)}…</code>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="uppercase tracking-wider">bloco</span>
            <a
              href={explorerTxUrl(registerTxHash ?? '')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary-dim hover:text-primary"
            >
              #{registerBlock}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        </div>
      ) : (
        <p className="border-outline-variant/30 border-t pt-3 font-label text-[11px] text-on-surface/50 lowercase">
          manifesto on-chain em breve · sprint 3
        </p>
      )}
    </section>
  );
}

// ---- Chat (mock, honest) -------------------------------------------------

interface ChatMessage {
  id: string;
  name: string;
  text: string;
  initials: string;
}

const MOCK_CHAT: ChatMessage[] = [
  {
    id: 'c1',
    name: 'marcos silva',
    initials: 'MS',
    text: 'amém pastor, essa palavra renova a alma hoje.',
  },
  {
    id: 'c2',
    name: 'lúcia beltrão',
    initials: 'LB',
    text: 'estamos em 4 aqui assistindo juntos em casa!',
  },
  {
    id: 'c3',
    name: 'ir. antônio',
    initials: 'IA',
    text: 'compartilhando com o grupo da célula agora.',
  },
];

function ChatBlock() {
  return (
    <section aria-labelledby="chat-heading" className="flex flex-col gap-3 pb-2">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="chat-heading"
          className="font-headline font-semibold text-base text-on-surface lowercase"
        >
          bate-papo
        </h2>
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
          amostra · sprint 3
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {MOCK_CHAT.map((msg) => (
          <li key={msg.id} className="flex items-start gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-container font-label font-semibold text-[10px] text-on-primary">
              {msg.initials}
            </span>
            <div className="flex flex-col">
              <span className="font-body font-medium text-on-surface text-sm lowercase">
                {msg.name}
              </span>
              <span className="font-body text-on-surface/80 text-sm">{msg.text}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5">
        <input
          type="text"
          disabled
          placeholder="envio habilitado na sprint 3"
          className="flex-1 bg-transparent font-body text-on-surface/60 text-sm placeholder:text-on-surface/30 focus:outline-none lowercase"
        />
        <button
          type="button"
          aria-label="enviar mensagem"
          disabled
          className="inline-flex size-8 items-center justify-center rounded-full bg-surface-high text-on-surface/40"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}

// ---- Mocks ---------------------------------------------------------------

const MOCK_REACTION_COUNTS = {
  amem: 428,
  orar: 211,
  boost: 87,
  salvar: 43,
  apoiar: 22,
} as const;

const MOCK_PRESENCE = [
  { id: 'p1', name: 'Lucas Andrade' },
  { id: 'p2', name: 'Marina Pires' },
  { id: 'p3', name: 'Elias Ramos' },
  { id: 'p4', name: 'Ana Teixeira' },
];
