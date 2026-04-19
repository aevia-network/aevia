/**
 * Aevia mesh session resolution.
 *
 * Given a WHIP session ID, resolve which provider-node holds the live
 * stream by consulting the DHT via any relay's `POST /dht/resolve`
 * endpoint. The SessionID is hashed into a deterministic CIDv1 (raw
 * codec, sha-256), matching services/provider-node/internal/sessioncid
 * so the provider's `dht.Provide(...)` call and the browser's resolve
 * address the same key.
 *
 * This replaces hardcoding a single `NEXT_PUBLIC_AEVIA_MESH_URL` base.
 * The SPOF is gone: any relay in `NEXT_PUBLIC_AEVIA_DHT_RELAYS` can
 * answer the resolve; the viewer dials whichever provider the DHT
 * points at. Failure fall-through still uses the legacy hub URL so
 * existing deploys keep working during rollout.
 */

import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';

export interface ResolvedProvider {
  /** libp2p peer ID from the DHT provider record. */
  peerId: string;
  /** HTTPS base URL the browser will hit for WHIP / WHEP / HLS. */
  httpsBase: string;
  /** libp2p multiaddrs the peerstore returned — for future libp2p clients. */
  multiaddrs: string[];
  /** Which relay answered the resolve. Handy for ops + logging. */
  resolvedVia: string;
}

export interface ResolveOptions {
  /** CSV of HTTP(S) relay endpoints that expose POST /dht/resolve. */
  relayUrls: string[];
  /**
   * Mapping from libp2p peer ID to the provider's HTTPS base URL.
   * Required because DHT provider records list multiaddrs (libp2p),
   * not the HTTPS URL a browser can reach. Provider operators publish
   * their (peerID, httpsBase) pair in this registry env so viewers can
   * translate. A later iteration embeds the URL in the DHT record
   * itself (Protocol Spec §4) so this env becomes optional.
   */
  peerRegistry: Record<string, string>;
  /** Fallback URL used when resolve fails entirely. */
  fallbackHttpsBase: string;
  /** Per-relay HTTP timeout in ms. Default 5000. */
  timeoutMs?: number;
  /** Abort controller forwarded to each fetch. */
  signal?: AbortSignal;
}

/**
 * Compute the deterministic CIDv1 for a session ID. Must match the Go
 * helper services/provider-node/internal/sessioncid/sessioncid.go.Of.
 */
export async function sessionIdToCid(sessionId: string): Promise<string> {
  if (!sessionId) throw new Error('sessionIdToCid: empty sessionId');
  const bytes = new TextEncoder().encode(sessionId);
  const digest = await sha256.digest(bytes);
  return CID.create(1, raw.code, digest).toString();
}

/**
 * Resolve a session via the DHT. Tries each relay in order; the first
 * one that returns a provider wins. Returns null if the session is not
 * announced yet (provider still negotiating, or session ended).
 *
 * Callers typically wrap this with the fallback:
 *
 * ```ts
 * const resolved = await resolveSessionProvider(id, opts);
 * const base = resolved?.httpsBase ?? opts.fallbackHttpsBase;
 * ```
 */
export async function resolveSessionProvider(
  sessionId: string,
  opts: ResolveOptions,
): Promise<ResolvedProvider | null> {
  if (opts.relayUrls.length === 0) return null;

  const cid = await sessionIdToCid(sessionId);
  const timeoutMs = opts.timeoutMs ?? 5_000;

  for (const relay of opts.relayUrls) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      if (opts.signal) {
        opts.signal.addEventListener('abort', () => ctl.abort(), { once: true });
      }

      const res = await fetch(`${stripTrailingSlash(relay)}/dht/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid, limit: 5 }),
        signal: ctl.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const body = (await res.json()) as {
        providers?: Array<{ peer_id: string; multiaddrs?: string[] }>;
      };
      if (!body.providers || body.providers.length === 0) continue;

      for (const p of body.providers) {
        const httpsBase = opts.peerRegistry[p.peer_id];
        if (!httpsBase) continue;
        return {
          peerId: p.peer_id,
          httpsBase,
          multiaddrs: p.multiaddrs ?? [],
          resolvedVia: relay,
        };
      }
    } catch {
      // Non-fatal — try next relay.
    }
  }
  return null;
}

/**
 * Plural variant — returns ALL providers the DHT knows about for this
 * session, in the order the responding relay listed them. Required by
 * Fase 2.3 viewer failover: when the active WHEP stream breaks, the
 * player walks the list and tries the next candidate instead of
 * giving up. The single-result helper is a thin wrapper around this
 * one for callers who only need one.
 *
 * Deduplicates by peerId so overlapping provider sets from multiple
 * relays don't produce duplicate entries.
 */
export async function resolveSessionProviders(
  sessionId: string,
  opts: ResolveOptions,
): Promise<ResolvedProvider[]> {
  if (opts.relayUrls.length === 0) return [];

  const cid = await sessionIdToCid(sessionId);
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const seen = new Set<string>();
  const out: ResolvedProvider[] = [];

  for (const relay of opts.relayUrls) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      if (opts.signal) {
        opts.signal.addEventListener('abort', () => ctl.abort(), { once: true });
      }
      const res = await fetch(`${stripTrailingSlash(relay)}/dht/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid, limit: 10 }),
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const body = (await res.json()) as {
        providers?: Array<{ peer_id: string; multiaddrs?: string[] }>;
      };
      if (!body.providers) continue;
      for (const p of body.providers) {
        if (seen.has(p.peer_id)) continue;
        const httpsBase = opts.peerRegistry[p.peer_id];
        if (!httpsBase) continue;
        seen.add(p.peer_id);
        out.push({
          peerId: p.peer_id,
          httpsBase,
          multiaddrs: p.multiaddrs ?? [],
          resolvedVia: relay,
        });
      }
      // If we got providers from this relay, stop — the DHT response
      // IS the authoritative list. Walking more relays mixes stale
      // data from a slow-to-update peer.
      if (out.length > 0) return out;
    } catch {
      // Non-fatal — try next relay.
    }
  }
  return out;
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

/**
 * Parse NEXT_PUBLIC_AEVIA_PROVIDER_REGISTRY. Accepts either:
 *   - JSON object: `{"12D3...": "https://provider..."}`
 *   - CSV pairs:   `"12D3...=https://provider...,12D3...=https://provider2..."`
 *
 * Returns empty object on any parse error so resolve falls through to
 * the fallback URL rather than hard-crashing.
 */
export function parseProviderRegistry(raw: string): Record<string, string> {
  const trimmed = raw?.trim();
  if (!trimmed) return {};
  try {
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as Record<string, string>;
    }
    const out: Record<string, string> = {};
    for (const pair of trimmed.split(',')) {
      const [peerId, url] = pair.split('=').map((s) => s.trim());
      if (peerId && url) out[peerId] = url;
    }
    return out;
  } catch {
    return {};
  }
}

/** Parse CSV list of relay URLs. */
export function parseRelayList(raw: string): string[] {
  return (
    raw
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}
