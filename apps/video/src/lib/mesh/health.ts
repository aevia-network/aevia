/**
 * Provider health lookups for the public transparency surface.
 *
 * The `/trust` page renders the *real* mesh — every provider operator
 * publishes a (peerID → httpsBase) pair in `NEXT_PUBLIC_AEVIA_PROVIDER_REGISTRY`,
 * and this module fetches `GET /healthz` from each so the page can plot the
 * live geography. When a provider is unreachable we still render it with a
 * `status: 'unreachable'` badge — honesty beats hiding outages.
 *
 * Shape matches services/provider-node/internal/httpx.healthResponse. Fields
 * marked optional there use `omitempty`, so operators that didn't configure
 * region/geo won't have those keys in the JSON — we return them as undefined.
 */
export interface ProviderHealthOk {
  status: 'ok';
  httpsBase: string;
  peerId: string;
  region?: string;
  lat?: number;
  lng?: number;
  /** Round-trip time to /healthz in ms, measured by the caller. */
  rttMs: number;
}

export interface ProviderHealthUnreachable {
  status: 'unreachable';
  httpsBase: string;
  /** The peer ID we registered for this URL, or undefined when not known. */
  peerId?: string;
  /** Best-effort classification for the UI copy. */
  reason: 'timeout' | 'network' | 'bad-json' | 'bad-shape' | 'non-2xx';
}

export type ProviderHealth = ProviderHealthOk | ProviderHealthUnreachable;

export interface FetchProviderHealthOptions {
  /** Per-request timeout in milliseconds. Default 2000. */
  timeoutMs?: number;
  /** Caller-supplied peer ID to carry through on unreachable responses. */
  peerId?: string;
  /** Replaces the global fetch — primarily for unit tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch /healthz from a single provider. Never throws — returns a
 * ProviderHealthUnreachable on any failure path so callers can render
 * an honest offline state instead of crashing the page.
 */
export async function fetchProviderHealth(
  httpsBase: string,
  opts: FetchProviderHealthOptions = {},
): Promise<ProviderHealth> {
  const timeoutMs = opts.timeoutMs ?? 2_000;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = httpsBase.replace(/\/+$/, '');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);

  const startedAt = Date.now();
  try {
    const res = await fetchImpl(`${base}/healthz`, {
      method: 'GET',
      signal: ctl.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        status: 'unreachable',
        httpsBase: base,
        peerId: opts.peerId,
        reason: 'non-2xx',
      };
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        status: 'unreachable',
        httpsBase: base,
        peerId: opts.peerId,
        reason: 'bad-json',
      };
    }
    if (!isHealthShape(body)) {
      return {
        status: 'unreachable',
        httpsBase: base,
        peerId: opts.peerId,
        reason: 'bad-shape',
      };
    }
    return {
      status: 'ok',
      httpsBase: base,
      peerId: body.peer_id,
      region: body.region,
      lat: body.lat,
      lng: body.lng,
      rttMs: Date.now() - startedAt,
    };
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network';
    return {
      status: 'unreachable',
      httpsBase: base,
      peerId: opts.peerId,
      reason,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch /healthz from every entry of a peerRegistry in parallel. Returns
 * results in registry-iteration order so the UI can render a stable grafo
 * layout across re-renders.
 */
export async function fetchMeshHealth(
  peerRegistry: Record<string, string>,
  opts: FetchProviderHealthOptions = {},
): Promise<ProviderHealth[]> {
  const entries = Object.entries(peerRegistry);
  if (entries.length === 0) return [];
  const results = await Promise.allSettled(
    entries.map(([peerId, httpsBase]) => fetchProviderHealth(httpsBase, { ...opts, peerId })),
  );
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const entry = entries[i];
    const [peerId, httpsBase] = entry ?? ['', ''];
    return {
      status: 'unreachable',
      httpsBase: httpsBase.replace(/\/+$/, ''),
      peerId,
      reason: 'network',
    };
  });
}

function isHealthShape(v: unknown): v is {
  status: string;
  peer_id: string;
  region?: string;
  lat?: number;
  lng?: number;
} {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.status !== 'string') return false;
  if (typeof o.peer_id !== 'string') return false;
  if (o.region !== undefined && typeof o.region !== 'string') return false;
  if (o.lat !== undefined && typeof o.lat !== 'number') return false;
  if (o.lng !== undefined && typeof o.lng !== 'number') return false;
  return true;
}

/** Short-form peerID for UI ("12D3Koo…abcd"). */
export function shortPeerId(peerId: string): string {
  if (peerId.length <= 12) return peerId;
  return `${peerId.slice(0, 8)}…${peerId.slice(-4)}`;
}
