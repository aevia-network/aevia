/**
 * Fase 3.2b — pubsub tracker (DEFERRED STUB).
 *
 * This module declares the wire types and roadmap for replacing the
 * public WebTorrent tracker list currently used by `chunk-relay.ts`
 * with a sovereign announce mechanism. Real wiring ships in a
 * follow-up; this file exists so the feature flag and TypeScript
 * shape can land first, giving downstream code a stable import path.
 *
 * See `chunk-relay.ts` header for the full context. Summary: the
 * current implementation announces against
 * `wss://tracker.webtorrent.dev` + `wss://tracker.openwebtorrent.com`.
 * Those are community-run and OK for a first cut, but long-term we
 * want announces to ride our own infra so swarm formation doesn't
 * depend on third-party availability.
 *
 * ─── Roadmap ────────────────────────────────────────────────────────
 *
 * Two paths are on the table. Both materialize the same topology
 * (browser viewer → our infra → peer discovery) but differ in where
 * the announce protocol terminates.
 *
 * Path A — `pnpm patch` p2p-media-loader-core to expose a
 *          `trackerClientConstructor` hook (~20 LOC diff).
 *
 *   The upstream engine constructs its BitTorrent-WS tracker client
 *   internally; it does NOT expose a constructor override today.
 *   A minimal pnpm patch injects a factory param at engine init so
 *   we can supply a custom tracker client that publishes announce
 *   events on our existing libp2p GossipSub mesh (topic
 *   `aevia-live-{sessionId}`) instead of opening a fresh WSS
 *   connection to a public tracker.
 *
 *   Pros: zero new listeners on provider-node; reuses the mesh
 *   already running. Cost budget ≈ 300 LOC adapter on the browser
 *   side (GossipSub announce packet → tracker client event shape).
 *
 *   Cons: patch is fragile across `p2p-media-loader-core` versions.
 *   Each minor bump needs a diff re-apply + CI test. Upstream has
 *   been receptive to the hook idea in issues but no PR yet.
 *
 * Path B — "Fase 3.2b" embedded BitTorrent WSS tracker on
 *          provider-node (~400 LOC Go).
 *
 *   Expose `wss://provider.aevia.network/announce` alongside the
 *   existing /libp2p/ws + /whep + /whip listeners. Implement the
 *   minimal subset of the BEP-0003 BitTorrent tracker protocol that
 *   WebTorrent / p2p-media-loader-core speak over WebSocket:
 *   `announce` (with `info_hash`, `peer_id`, `event`, `offer`/
 *   `answer` payloads) and the swarm peer list response.
 *
 *   Pros: no client patch, no pnpm monkey-business. Provider-node
 *   gains a small self-contained subsystem that can be measured /
 *   rate-limited / access-controlled independently. Survives
 *   `p2p-media-loader-core` major upgrades without action.
 *
 *   Cons: ~400 LOC Go + tests + Caddy route + CI. Bigger upfront
 *   commit than Path A. Marginal extra attack surface per provider.
 *
 * ─── Decision posture ─────────────────────────────────────────────
 *
 * Current lean: Path A first as an experiment on a single provider
 * (opt-in via `?tracker=pubsub`), measure whether the GossipSub
 * announce overhead stays under the P2P engine's wire budget, and
 * promote to Path B if we see sustained swarm fragmentation across
 * provider partitions. Both paths converge on the same viewer
 * behaviour — what changes is where the protocol terminates.
 *
 * ─── Feature flag ──────────────────────────────────────────────────
 *
 * `?tracker=pubsub` in the URL is a no-op in this commit: it logs a
 * `"pubsub tracker deferred — see pubsub-tracker.ts"` line and then
 * falls through to the default public-tracker list. This keeps the
 * flag name stable so docs, Playwright specs, and operator tooling
 * can reference it ahead of the real wiring. When Path A or B lands
 * the flag flips from no-op to dispatcher.
 */

/**
 * Wire message shape for the pubsub announce protocol. Browser
 * viewers publish these on the libp2p GossipSub topic
 * `aevia-live-{sessionId}/tracker` once either path above is live.
 * Encoded with JSON for debuggability in the first cut; a varint/
 * protobuf encoding can follow if wire volume ever matters.
 *
 * Discriminated on `type` so consumers can switch exhaustively.
 */
export type PubsubTrackerMessage = PubsubAnnounce | PubsubWant | PubsubPeer;

/**
 * Viewer → swarm: "I have these segments and I'm reachable at this
 * browser-side peerID." Emitted on swarm join and on each new
 * segment becoming available locally (throttled upstream).
 */
export interface PubsubAnnounce {
  type: 'announce';
  /** libp2p PeerID of the announcing browser. */
  peerId: string;
  /** Opaque WebTorrent-compatible infoHash. Scoped per sessionId
   * upstream so unrelated lives don't collide in the same topic. */
  infoHash: string;
  /** List of segment identifiers this peer currently serves. */
  available: string[];
  /** Monotonic clock on the announcer, for deduping. */
  ts: number;
}

/**
 * Viewer → swarm: "I want this segment, anyone serving?" Replies
 * come back as `peer` messages from whoever has capacity.
 */
export interface PubsubWant {
  type: 'want';
  peerId: string;
  infoHash: string;
  /** Segment identifier the viewer is missing. */
  want: string;
  ts: number;
}

/**
 * Viewer → viewer: "Here's my contact info for a direct
 * WebRTC DataChannel handshake." Bridges the announce + data
 * planes — once two browsers exchange this pair, they establish a
 * direct chunk relay channel just like the public-tracker flow.
 */
export interface PubsubPeer {
  type: 'peer';
  /** Peer we're responding to. */
  to: string;
  /** Our own libp2p peerID. */
  from: string;
  infoHash: string;
  /** SDP offer or answer. The protocol terminates in the
   * WebTorrent client just like the WSS tracker version. */
  sdp: string;
  sdpType: 'offer' | 'answer';
  ts: number;
}

/**
 * No-op implementation of the `?tracker=pubsub` feature flag.
 * Called from the chunk-relay wiring once the flag is wired; today
 * the chunk-relay still hard-codes the public tracker list, so this
 * is reserved surface for the follow-up commit that binds the flag.
 *
 * Returns `false` so callers keep using the default tracker list.
 * Emits a single console line (debug-level equivalent) so operators
 * flipping the flag in the field see immediate feedback that the
 * path is not yet live.
 */
export function tryEnablePubsubTracker(sessionId: string): boolean {
  console.info(
    `[p2p:tracker] pubsub tracker deferred — see pubsub-tracker.ts (session=${sessionId})`,
  );
  return false;
}
