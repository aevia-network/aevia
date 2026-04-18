/**
 * Aevia mesh — RTT probing + final selection.
 *
 * Fase 1.2 of the "zero CDN, outperform CDN" roadmap. Geography
 * alone is a proxy (rank.ts); actual network RTT is the truth. This
 * module wraps health.ts to: (1) probe /healthz of a short-list of
 * providers in parallel, (2) return them sorted by measured rttMs,
 * (3) pick the single best candidate.
 *
 * Callers typically chain with rankProvidersByRegion so the short-list
 * is already geographically plausible — probing 100 providers wastes
 * the viewer's bandwidth before picking one.
 *
 *   const ranked = rankProvidersByRegion(all, viewer);
 *   const best = await pickBestProvider(ranked.slice(0, 5), viewer);
 *   // best.httpsBase is the URL to POST WHIP or GET HLS against.
 *
 * Unreachable providers are dropped from the ranking entirely — the
 * caller typically wants "whom do I dial", not "what is the state of
 * the mesh". For the state view (see /trust grafo) callers should use
 * fetchMeshHealth directly.
 */

import {
  type FetchProviderHealthOptions,
  type ProviderHealth,
  type ProviderHealthOk,
  fetchProviderHealth,
} from './health';
import type { ProviderMeta } from './rank';

export interface RTTProbeResult {
  /** Provider metadata echoed back for the caller. */
  provider: ProviderMeta;
  /** Measured round-trip time in ms to GET /healthz. */
  rttMs: number;
  /** Live shape from /healthz — peerID + region + geo as published. */
  health: ProviderHealthOk;
}

export interface ProbeOptions {
  /** Per-request timeout. Default 1500 ms — shorter than the /trust
   *  grafo default (2000) because the viewer is actively waiting. */
  timeoutMs?: number;
  /** Replaces global fetch — tests pass a controllable stub. */
  fetchImpl?: typeof fetch;
}

/**
 * Probe /healthz of each provider in parallel and return only the
 * reachable ones, sorted ascending by measured RTT. Never throws —
 * returns an empty array when every provider is unreachable.
 *
 * Respects the input order as the stable tiebreaker when two probes
 * come back with identical rttMs (rare, but possible on LAN or with
 * cached TCP connections).
 */
export async function probeProvidersRTT(
  providers: ProviderMeta[],
  opts: ProbeOptions = {},
): Promise<RTTProbeResult[]> {
  if (providers.length === 0) return [];

  const fetchOpts: FetchProviderHealthOptions = {
    timeoutMs: opts.timeoutMs ?? 1_500,
    fetchImpl: opts.fetchImpl,
  };

  const settled = await Promise.allSettled(
    providers.map((p) => fetchProviderHealth(p.httpsBase, { ...fetchOpts, peerId: p.peerId })),
  );

  const results: Array<RTTProbeResult & { originalIdx: number }> = [];
  settled.forEach((r, idx) => {
    if (r.status !== 'fulfilled') return;
    const provider = providers[idx];
    if (!provider) return;
    const health = r.value;
    if (!isReachable(health)) return;
    results.push({
      provider,
      rttMs: health.rttMs,
      health,
      originalIdx: idx,
    });
  });

  results.sort((a, b) => {
    if (a.rttMs !== b.rttMs) return a.rttMs - b.rttMs;
    return a.originalIdx - b.originalIdx;
  });

  return results.map(({ provider, rttMs, health }) => ({ provider, rttMs, health }));
}

/**
 * Convenience wrapper: probe the short-list, return the winner or
 * null when every candidate is unreachable. Equivalent to:
 *   (await probeProvidersRTT(list, opts))[0] ?? null
 */
export async function pickBestProviderByRTT(
  providers: ProviderMeta[],
  opts: ProbeOptions = {},
): Promise<RTTProbeResult | null> {
  const ranked = await probeProvidersRTT(providers, opts);
  return ranked[0] ?? null;
}

function isReachable(h: ProviderHealth): h is ProviderHealthOk {
  return h.status === 'ok';
}
