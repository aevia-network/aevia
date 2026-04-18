import { StudioScreen } from '@/components/studio-screen';
import { listLiveInputs } from '@/lib/cloudflare/stream-client';
import { addressToDid, shortAddress } from '@aevia/auth';
import { readAeviaSession } from '@aevia/auth/server';
import { redirect } from 'next/navigation';
import type { LiveRowData } from './live-row';

export const runtime = 'edge';
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await readAeviaSession();
  if (!session) redirect('/');

  let myLives: LiveRowData[] = [];
  try {
    const all = await listLiveInputs();
    const me = session.address.toLowerCase();
    // Ownership lookup prefers `meta.creatorAddress` (we set this ourselves on
    // creation and Cloudflare round-trips `meta` reliably). `defaultCreator`
    // is the canonical Cloudflare field but most account tiers silently drop
    // it on POST, leaving it `null` on GET. Keep it as a fallback for legacy
    // live inputs created before the meta mirror landed.
    myLives = all
      .filter((l) => {
        const metaCreator = l.meta?.creatorAddress?.toLowerCase();
        const defaultCreator = l.defaultCreator?.toLowerCase();
        return metaCreator === me || defaultCreator === me;
      })
      .map((l) => ({
        uid: l.uid,
        state: (l.status?.current?.state as LiveRowData['state']) ?? 'disconnected',
        name: l.meta?.name ?? '',
        created: l.created,
        recordingVideoUid: l.meta?.recordingVideoUid,
        manifestCid: l.meta?.manifestCid,
        registerTxHash: l.meta?.registerTxHash,
        registerBlock: l.meta?.registerBlock ? Number(l.meta.registerBlock) : undefined,
      }))
      .sort((a, b) => (a.created < b.created ? 1 : -1));
  } catch {
    // Cloudflare transient unreachable — render empty list gracefully.
  }

  return (
    <StudioScreen
      viewer={{
        displayName: session.displayName,
        shortAddress: shortAddress(session.address),
        did: addressToDid(session.address, 84532),
        loginMethod: session.loginMethod === 'unknown' ? 'conectado' : session.loginMethod,
      }}
      lives={myLives}
    />
  );
}
