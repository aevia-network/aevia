import { TrustScreen } from '@/components/trust-screen';
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
 */
export default async function TrustPage() {
  const session = await readAeviaSession().catch(() => null);
  const viewer = session
    ? {
        did: addressToDid(session.address, 84532),
        shortAddress: shortAddress(session.address),
      }
    : null;

  return <TrustScreen viewer={viewer} />;
}
