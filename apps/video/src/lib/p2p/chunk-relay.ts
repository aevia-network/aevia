/**
 * Fase 3.2 — HLS chunk relay via WebRTC DataChannel.
 *
 * Wires `p2p-media-loader-hlsjs` into an existing `hls.js` instance so
 * HLS segments + parts flow between viewers over WebRTC DataChannels
 * instead of every viewer pulling from the origin provider. Stack:
 *
 *   - hls.js (already in use for LL-HLS playback)
 *   - p2p-media-loader-hlsjs: custom hls.js loader that wraps the P2P
 *     engine; seamless fallback to origin when a chunk isn't
 *     available from peers
 *   - p2p-media-loader-core: WebTorrent protocol over DataChannel,
 *     with announce trackers for swarm formation
 *
 * Trackers: for the first cut we use public WebTorrent trackers
 * (tracker.webtorrent.dev + tracker.openwebtorrent.com). These are
 * run by the WebTorrent community, well-peered, and used by
 * production installations (PeerTube, RTVE). This is deliberately
 * temporary — sovereignty on announce is already on the roadmap:
 *
 *   Fase 3.2b option A: Embed a BitTorrent WebSocket tracker
 *     protocol handler in the provider-node Go stack. Exposes
 *     wss://provider.aevia.network/announce alongside /libp2p/ws +
 *     /whep + /whip. ~400 LOC, reuses existing Caddy / CF Tunnel.
 *
 *   Fase 3.2b option B: Replace the tracker layer entirely with
 *     our existing libp2p GossipSub mesh (`aevia-live-{sessionId}`
 *     topic). Viewers publish segment availability announcements
 *     there; `p2p-media-loader-core` exposes a
 *     `trackerClientConstructor` hook that lets us implement a
 *     custom announce backend. Zero extra listener on the
 *     provider-node — mesh already routes. ~300 LOC adapter.
 *
 * Once either 3.2b ships, this module's tracker list changes to
 * point at our own infra (or drops the announce list entirely in
 * favor of the GossipSub bridge). Client-side migration is a
 * one-line config flip.
 *
 * SwarmId is scoped per-session so unrelated lives don't see each
 * other's chunks on the DHT (and we don't accidentally cross
 * streams due to a shared tracker announce).
 *
 * Metrics: the P2P engine emits `onSegmentLoaded` events with
 * source="p2p"|"http" — callers pass an `onStats` callback that
 * receives the running ratio (bytes from peers / total bytes) to
 * drive UI such as the PermanenceStrip L1 sage indicator.
 */

import HlsCtor from 'hls.js';
import type Hls from 'hls.js';
import type { HlsConfig } from 'hls.js';
import { HlsJsP2PEngine } from 'p2p-media-loader-hlsjs';

export interface ChunkRelayOptions {
  /** Live/VOD session ID — used as a swarm discriminator so unrelated
   * lives don't accidentally cross-pollinate on the tracker. */
  sessionId: string;
  /** Raw hls.js config (sans p2p) the caller would normally pass to
   * `new Hls()`. We wrap it with `HlsJsP2PEngine.injectMixin()` — the
   * only engine entry point that actually installs the P2P fragment
   * loader class into hls.js at construction time. The plain
   * `bindHls()` method alone is NOT enough: it attaches event
   * listeners but leaves the default HTTP fragment loader in place,
   * so `onChunkDownloaded` never fires and the P2P engine is dead
   * weight. Learned the hard way during Fase 3.2 step 1 validation. */
  hlsConfig: Partial<HlsConfig>;
  /** Fires whenever a chunk lands, with running P2P ratio stats. */
  onStats?: (stats: ChunkRelayStats) => void;
}

export interface ChunkRelayStats {
  /** Bytes fetched from peers so far. */
  bytesFromPeers: number;
  /** Bytes fetched from the origin (HTTP) so far. */
  bytesFromHttp: number;
  /** Bytes uploaded to other peers (our contribution upstream). */
  bytesUploaded: number;
  /** Running ratio bytesFromPeers / (bytesFromPeers + bytesFromHttp).
   * 0 before first chunk arrives. */
  ratio: number;
  /** Count of peers currently connected in the swarm. */
  peerCount: number;
}

export interface ChunkRelayHandle {
  /** The P2P-wrapped hls.js instance, ready for `loadSource` +
   * `attachMedia`. Use this exactly like a normal hls.js object —
   * all standard events (MANIFEST_PARSED, ERROR, etc) work on it. */
  hls: Hls;
  /** Snapshot — reads in-memory counters, cheap. */
  stats: () => ChunkRelayStats;
  /** Shut down the P2P engine + destroy the wrapped hls.js instance.
   * Idempotent. */
  stop: () => void;
}

const PUBLIC_TRACKERS = ['wss://tracker.webtorrent.dev', 'wss://tracker.openwebtorrent.com'];

/**
 * Creates a hls.js instance wrapped with p2p-media-loader's fragment
 * loader. Uses `HlsJsP2PEngine.injectMixin(Hls)` — the official
 * entry point that BOTH wires the P2P events AND injects the custom
 * fragment / playlist loaders at class construction. Replaces a
 * plain `new Hls(config)` in the caller.
 */
export function wireChunkRelay(opts: ChunkRelayOptions): ChunkRelayHandle {
  // Mix the P2P engine into Hls.js. Returns an Hls subclass whose
  // constructor accepts the standard HlsConfig plus a `p2p` option.
  const HlsWithP2P = HlsJsP2PEngine.injectMixin(HlsCtor);

  const hls = new HlsWithP2P({
    ...opts.hlsConfig,
    p2p: {
      core: {
        swarmId: `aevia-${opts.sessionId}`,
        announceTrackers: PUBLIC_TRACKERS,
        // Live-tuned timeouts: prefer HTTP when P2P hasn't delivered
        // within 1.5s, but don't give up on a live tail segment too
        // early. VOD could afford 4s+ but live budget is tighter.
        simultaneousHttpDownloads: 3,
        simultaneousP2PDownloads: 3,
        httpNotReceivingBytesTimeoutMs: 6_000,
      },
    },
  });

  const engine = hls.p2pEngine;

  const counters: ChunkRelayStats = {
    bytesFromPeers: 0,
    bytesFromHttp: 0,
    bytesUploaded: 0,
    ratio: 0,
    peerCount: 0,
  };

  // onChunkDownloaded fires at chunk granularity (smaller than full
  // segment), so ratio resolves faster than waiting for onSegmentLoaded.
  // downloadSource is the authoritative per-chunk origin — 'p2p' or
  // 'http'. Accumulate locally + push to onStats so UI can render.
  engine.addEventListener('onChunkDownloaded', (bytesLength, downloadSource) => {
    if (downloadSource === 'p2p') {
      counters.bytesFromPeers += bytesLength;
    } else {
      counters.bytesFromHttp += bytesLength;
    }
    const total = counters.bytesFromPeers + counters.bytesFromHttp;
    counters.ratio = total > 0 ? counters.bytesFromPeers / total : 0;
    opts.onStats?.({ ...counters });
  });

  // We're also a contributor — track upload so we can surface a
  // "servindo X MB pra N peers" indicator (PermanenceStrip future).
  engine.addEventListener('onChunkUploaded', (bytesLength) => {
    counters.bytesUploaded += bytesLength;
    opts.onStats?.({ ...counters });
  });

  engine.addEventListener('onPeerConnect', () => {
    counters.peerCount += 1;
    opts.onStats?.({ ...counters });
  });
  engine.addEventListener('onPeerClose', () => {
    counters.peerCount = Math.max(0, counters.peerCount - 1);
    opts.onStats?.({ ...counters });
  });

  return {
    hls: hls as unknown as Hls,
    stats: () => ({ ...counters }),
    stop: () => {
      try {
        hls.destroy();
      } catch {
        // hls.destroy also tears down the p2pEngine. Idempotent.
      }
    },
  };
}
