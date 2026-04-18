/**
 * Aevia mesh — precision RTT measurement against /latency-probe.
 *
 * `fetchProviderHealth` measures a single GET /healthz RTT; good for
 * "is the node reachable?" but noisy for latency claims because:
 *
 *   1. /healthz returns JSON — bytes on wire + marshal overhead mask
 *      the raw network RTT
 *   2. One sample is not a distribution — TCP slow-start, TLS resume,
 *      sporadic packet loss all distort the single-shot number
 *
 * `measureRoundTrip` does the honest thing: N HEAD requests to
 * /latency-probe (zero body, no JSON), discard the first (TLS warm-up),
 * return p50/p95/p99 + raw samples. This is what the /trust grafo
 * should render when it claims "rtt 315ms" — and what the mirror
 * selector will use when picking the closest origin.
 *
 * Per Fase 2.0 — "melhor que CDN" is not claimable without a
 * credible latency number. This is the foundation.
 */

export interface RoundTripOptions {
  /** How many probe requests to send. Default 5. */
  samples?: number;
  /** Milliseconds per request before abort. Default 1500. */
  timeoutMs?: number;
  /** Replaces global fetch — for unit tests. */
  fetchImpl?: typeof fetch;
  /** Forwards to AbortSignal of each request. */
  signal?: AbortSignal;
}

export interface RoundTripResult {
  /** URL hit — normalized (trailing-slash removed). */
  httpsBase: string;
  /** Successful probe count. Callers should ignore results when 0. */
  okCount: number;
  /** Failed attempts (timeout / network / non-2xx). */
  errorCount: number;
  /** All successful sample RTTs in ms, sorted ascending. */
  samples: number[];
  /** p50 in ms. NaN when okCount === 0. */
  p50: number;
  /** p95 in ms. Equals p50 when okCount < 3. */
  p95: number;
  /** p99 in ms. Equals p95 when okCount < 5. */
  p99: number;
  /** Minimum sample — useful for "best case" under zero load. */
  min: number;
  /** Maximum sample — useful for worst-case diagnostic. */
  max: number;
}

/**
 * Send N HEAD /latency-probe requests serially (sequential — parallel
 * fires would split TCP congestion windows and confuse measurements),
 * discard the first as TLS warm-up, return percentiles.
 *
 * Serial on purpose: we want to measure RTT under *this* viewer's
 * actual TCP window with this host, not the behaviour under concurrent
 * contention. Mirror selection in Fase 2.2 runs this for multiple
 * providers in parallel; within each provider it's serial.
 */
export async function measureRoundTrip(
  httpsBase: string,
  opts: RoundTripOptions = {},
): Promise<RoundTripResult> {
  const base = httpsBase.replace(/\/+$/, '');
  const samplesCount = Math.max(1, opts.samples ?? 5);
  const timeoutMs = opts.timeoutMs ?? 1_500;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const samples: number[] = [];
  let errorCount = 0;

  for (let i = 0; i < samplesCount; i++) {
    const rtt = await probeOnce(base, timeoutMs, fetchImpl, opts.signal);
    if (rtt === null) {
      errorCount++;
      continue;
    }
    if (i === 0 && samplesCount > 1) {
      // Warm-up — TLS session ticket + TCP slow-start skew the first
      // sample upward. Discard when we have room.
      continue;
    }
    samples.push(rtt);
  }

  samples.sort((a, b) => a - b);
  const okCount = samples.length;

  return {
    httpsBase: base,
    okCount,
    errorCount,
    samples,
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    p99: percentile(samples, 0.99),
    min: okCount > 0 ? (samples[0] ?? Number.NaN) : Number.NaN,
    max: okCount > 0 ? (samples[okCount - 1] ?? Number.NaN) : Number.NaN,
  };
}

async function probeOnce(
  base: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  callerSignal?: AbortSignal,
): Promise<number | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  if (callerSignal) {
    callerSignal.addEventListener('abort', () => ctl.abort(), { once: true });
  }
  const started = performance.now();
  try {
    const res = await fetchImpl(`${base}/latency-probe`, {
      method: 'HEAD',
      signal: ctl.signal,
      cache: 'no-store',
    });
    if (!res.ok && res.status !== 204) return null;
    return performance.now() - started;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0] as number;
  // Nearest-rank method — simple, stable, obvious. For N<20 which is
  // our regime (5 samples is the default) linear interpolation adds
  // nothing meaningful.
  const idx = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[Math.max(0, idx)] as number;
}
