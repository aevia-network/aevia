import { TrustScreen } from '@/components/trust-screen';
import { fetchMeshHealth } from '@/lib/mesh/health';
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
 * The `mesh ao vivo` section materializes the thesis on the UI: every
 * registered provider's /healthz is fetched server-side in parallel so
 * viewers can see the real geographic distribution — region, coordinates,
 * RTT — instead of CDN-opaque "100+ POPs" marketing copy.
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
  return fetchMeshHealth(registry, { timeoutMs: 2_000 });
}
