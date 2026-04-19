import { getServerEnv } from '../env';

/**
 * Thin Livepeer Studio API client. Raw fetch — we deliberately skip the
 * `livepeer` npm SDK to keep the edge bundle small and avoid pulling
 * server-Node-only deps (the SDK historically ships zlib + http modules
 * that fail at @cloudflare/next-on-pages compile time).
 *
 * API reference: https://docs.livepeer.org/reference/api
 *
 * Why Livepeer as a third backend (alongside Cloudflare Stream and
 * aevia-mesh): see OPPORTUNITY.md §6 for the full rationale —
 * decentralised infra, ~100x cheaper at high viewer fan-out, narrative
 * fit ("soberania descentralizada"), portfolio listing on
 * livepeer.org/ecosystem.
 */

const API_BASE = 'https://livepeer.studio/api';

export interface LivepeerStream {
  /** Stream UID assigned by Livepeer Studio. Stable across the stream's lifetime. */
  id: string;
  /** Human-readable name (we set this to the live's title or a creator-derived slug). */
  name: string;
  /** Secret stream key. Used in the WHIP ingest URL — DO NOT expose to viewers. */
  streamKey: string;
  /** Public playback ID. Used in `lvpr.tv/{id}` and the WebRTC playback URL. */
  playbackId: string;
  /** When true, Livepeer retains a recording asset accessible via the same playbackId. */
  record: boolean;
  /** Wall-clock creation timestamp (ms since epoch). */
  createdAt: number;
}

interface RawLivepeerStream {
  id: string;
  name: string;
  streamKey: string;
  playbackId: string;
  record?: boolean;
  createdAt: number;
}

function authHeaders(): HeadersInit {
  const env = getServerEnv();
  if (!env.LIVEPEER_API_KEY) {
    throw new Error('LIVEPEER_API_KEY required for Livepeer backend. See SETUP.md.');
  }
  return {
    Authorization: `Bearer ${env.LIVEPEER_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function handle<T>(res: Response, op: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Livepeer API ${op} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/**
 * Create a new Livepeer stream. The returned record contains everything the
 * client needs to broadcast (`streamKey` for WHIP ingest URL) and play
 * (`playbackId` for WebRTC playback URL).
 *
 * Recording is on by default — when the broadcast ends, Livepeer creates an
 * asset accessible via the same playback ID. No separate VOD upload needed
 * (contrast with Cloudflare WHIP beta, where we record client-side and tus
 * the blob up after the fact).
 */
export async function createLivepeerStream(opts: {
  name: string;
  /** Lowercase 0x-prefixed creator address — included in stream metadata for ownership lookup. */
  creatorAddress: `0x${string}`;
  /** Optional creator DID — surfaced on the player UI for attribution. */
  creatorDid?: string;
  /** Disable recording for ephemeral test streams. Default: true (record on). */
  record?: boolean;
}): Promise<LivepeerStream> {
  const res = await fetch(`${API_BASE}/stream`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: opts.name,
      record: opts.record ?? true,
      // Profiles control the transcoding ladder. Esports-friendly defaults:
      // 1080p60 top + 720p60 + 480p30 — covers desktop high, mobile, and
      // low-bandwidth fallback. Livepeer transcodes on its public network;
      // viewer ABR happens automatically on the lvpr.tv player and on raw
      // WebRTC playback.
      profiles: [
        { name: '1080p60', bitrate: 4_500_000, fps: 60, width: 1920, height: 1080 },
        { name: '720p60', bitrate: 2_500_000, fps: 60, width: 1280, height: 720 },
        { name: '480p30', bitrate: 1_000_000, fps: 30, width: 854, height: 480 },
      ],
      // `userTags` round-trip on the GET /stream/{id} response so we can
      // resolve ownership later without a separate index.
      userTags: {
        creatorAddress: opts.creatorAddress.toLowerCase(),
        ...(opts.creatorDid && { creatorDid: opts.creatorDid }),
        platform: 'aevia.video',
      },
    }),
  });
  const raw = await handle<RawLivepeerStream>(res, 'createStream');
  return normaliseStream(raw);
}

export async function getLivepeerStream(id: string): Promise<LivepeerStream | null> {
  const res = await fetch(`${API_BASE}/stream/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  const raw = await handle<RawLivepeerStream>(res, 'getStream');
  return normaliseStream(raw);
}

export async function deleteLivepeerStream(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/stream/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  // 404 = already gone; treat as success.
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new Error(`Livepeer API deleteStream failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

function normaliseStream(raw: RawLivepeerStream): LivepeerStream {
  return {
    id: raw.id,
    name: raw.name,
    streamKey: raw.streamKey,
    playbackId: raw.playbackId,
    record: raw.record ?? false,
    createdAt: raw.createdAt,
  };
}

/**
 * Build the canonical WHIP ingest URL for a given stream key. Note this is
 * the BASE URL that triggers a HEAD redirect to the geographically-closest
 * Livepeer POP — the actual SDP POST goes to the redirect target. The
 * client-side `publishWhipLivepeer` helper handles the HEAD step.
 *
 * Why HEAD-then-redirect: Livepeer's media pipeline is geographically
 * distributed (LAX, FRA, MIA, etc.). The HEAD request lets the broadcaster's
 * own GeoDNS resolution pick the optimal POP rather than ours. Doing the
 * HEAD server-side would route based on our edge IP, not the user's.
 */
export function livepeerIngestUrl(streamKey: string): string {
  return `${API_BASE.replace('/api', '')}/webrtc/${streamKey}`;
}

/**
 * Build the canonical WHEP playback URL for a given playback ID. Same
 * HEAD-redirect pattern as ingest — the `playWhepLivepeer` helper resolves
 * it before SDP negotiation.
 */
export function livepeerPlaybackUrl(playbackId: string): string {
  return `${API_BASE.replace('/api', '')}/webrtc/${playbackId}`;
}

/**
 * Build the managed UI player URL — drop in an iframe for zero-config
 * playback. We use this as the "fallback link" surfaced under the inline
 * WHEP player so viewers without WebRTC can still watch via Livepeer's
 * adaptive HLS player.
 */
export function livepeerPlayerUrl(playbackId: string): string {
  return `https://lvpr.tv/?v=${playbackId}`;
}
