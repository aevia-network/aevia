/**
 * Aevia mesh VOD manifest fetch + interpretation.
 *
 * When a live session ends on a provider-node, the node emits a
 * canonical `/live/{sessionID}/manifest.json` (see services/provider-node/
 * internal/whip/manifest.go VODManifest). Viewers arriving after the
 * stream closed consume this to reconstruct a seekable HLS VOD playlist
 * and — critically — to verify bytes independently via the Merkle root.
 *
 * Flow inside the viewer page:
 *
 *   1. Try `GET /live/{id}/playlist.m3u8` with hls.js.
 *   2. If hls.js reports ENDLIST present → playback is already VOD-safe,
 *      nothing else to do. (No network switching.)
 *   3. If hls.js errors with a fatal network error OR the manifest.json
 *      is available, switch to VOD mode: fetch manifest.json and render
 *      metadata (duration, segment count, Merkle root) alongside the
 *      player. Bytes come from the same HLS playlist endpoint; the
 *      manifest is the "receipt" that makes the playback verifiable.
 */

export interface AeviaVODManifest {
  version: number;
  session_id: string;
  cid: string;
  merkle_root: string;
  segment_count: number;
  segment_duration_secs: number;
  segment_cids: string[];
  started_at_iso: string;
  ended_at_iso: string;
}

export interface FetchVODOptions {
  /** HTTPS base URL of the provider-node that serves this session. */
  httpsBase: string;
  /** WHIP session ID (used as the URL path parameter). */
  sessionId: string;
  /** Abort signal forwarded to fetch. */
  signal?: AbortSignal;
  /** Per-request timeout in ms. Default 5000. */
  timeoutMs?: number;
}

/**
 * Fetch the VOD manifest JSON for a closed session. Resolves to null
 * when the session is still live (provider returns 404 until Finalize
 * is called) or the provider is unreachable. Non-null responses are
 * validated at the shape level — structurally malformed payloads throw.
 */
export async function fetchVODManifest(opts: FetchVODOptions): Promise<AeviaVODManifest | null> {
  const base = opts.httpsBase.replace(/\/+$/, '');
  const url = `${base}/live/${encodeURIComponent(opts.sessionId)}/manifest.json`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 5_000);
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => ctl.abort(), { once: true });
  }

  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`VOD manifest ${res.status} from ${url}`);
    }
    const body = (await res.json()) as unknown;
    return assertVODManifestShape(body);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compute the total duration of the VOD in seconds. segment_duration_secs
 * is TargetSegmentDuration on the server (constant 6s today); future
 * iterations with per-segment variable duration will need a different
 * representation — we hide that behind this helper so callers don't
 * need to care.
 */
export function vodDurationSecs(m: AeviaVODManifest): number {
  return m.segment_count * m.segment_duration_secs;
}

function assertVODManifestShape(v: unknown): AeviaVODManifest {
  if (!v || typeof v !== 'object') {
    throw new Error('VOD manifest: not an object');
  }
  const m = v as Record<string, unknown>;
  const required: Array<keyof AeviaVODManifest> = [
    'version',
    'session_id',
    'cid',
    'merkle_root',
    'segment_count',
    'segment_duration_secs',
    'segment_cids',
    'started_at_iso',
    'ended_at_iso',
  ];
  for (const k of required) {
    if (!(k in m)) throw new Error(`VOD manifest: missing field ${String(k)}`);
  }
  if (typeof m.merkle_root !== 'string' || !/^[0-9a-f]{64}$/.test(m.merkle_root)) {
    throw new Error('VOD manifest: merkle_root must be 32-byte hex');
  }
  if (!Array.isArray(m.segment_cids)) {
    throw new Error('VOD manifest: segment_cids must be an array');
  }
  if ((m.segment_cids as unknown[]).length !== m.segment_count) {
    throw new Error('VOD manifest: segment_cids length != segment_count');
  }
  return m as unknown as AeviaVODManifest;
}
