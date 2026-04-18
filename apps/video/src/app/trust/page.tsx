import { TrustScreen } from '@/components/trust-screen';
import { type ProviderHealth, fetchMeshHealth } from '@/lib/mesh/health';
import { type RoundTripResult, measureRoundTrip } from '@/lib/mesh/latency';
import { parseProviderRegistry } from '@/lib/mesh/resolve';
import { addressToDid, shortAddress } from '@aevia/auth';
import { readAeviaSession } from '@aevia/auth/server';

export const runtime = 'edge';
export const revalidate = 0;

/**
 * Public transparency ledger. Mirrors Stitch canonical
 * `6bc79a6084f74b2182ce7444e5fced05` ("Aevia — Transparência e Governança").
 *
 * Designed to be readable without authentication — the page is the pedagogy
 * of the thesis. When a session is present, the "meu histórico" block renders
 * the viewer's DID; otherwise the block explains what would appear.
 *
 * Mesh section combines two live probes per provider:
 *   1. GET /healthz — identity + geo + reachability (fetchMeshHealth).
 *   2. 5x HEAD /latency-probe — p50/p95 RTT distribution (measureRoundTrip,
 *      Fase 2.0 observability foundation). This is the honest "latência"
 *      the page surfaces, NOT a single cherry-picked sample.
 *
 * Both probes run server-side from the edge function, in parallel across
 * providers and sequential within a provider. Edge-to-provider RTT is a
 * *different* number than viewer-to-provider RTT — the page annotates
 * this clearly in the UI copy so readers don't conflate.
 */
export default async function TrustPage() {
  const [session, mesh] = await Promise.all([
    readAeviaSession().catch(() => null),
    loadMeshSnapshot(),
  ]);

  const viewer = session
    ? {
        did: addressToDid(session.address, 84532),
        shortAddress: shortAddress(session.address),
      }
    : null;

  return <TrustScreen viewer={viewer} mesh={mesh} />;
}

async function loadMeshSnapshot() {
  const registry = parseProviderRegistry(process.env.NEXT_PUBLIC_AEVIA_PROVIDER_REGISTRY ?? '');
  const health = await fetchMeshHealth(registry, { timeoutMs: 2_000 });
  return Promise.all(
    health.map(async (h: ProviderHealth) => {
      if (h.status !== 'ok') return { health: h, latency: null };
      const latency = await measureRoundTrip(h.httpsBase, {
        samples: 5,
        timeoutMs: 1_500,
      }).catch<RoundTripResult | null>(() => null);
      return { health: h, latency };
    }),
  );
}
