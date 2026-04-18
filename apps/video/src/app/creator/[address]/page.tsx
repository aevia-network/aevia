import { type CreatorLive, CreatorScreen } from '@/components/creator-screen';
import { listLiveInputs } from '@/lib/cloudflare/stream-client';
import { streamThumbnailUrl } from '@/lib/cloudflare/stream-urls';
import { addressToDid, shortAddress } from '@aevia/auth';
import { readAeviaSession } from '@aevia/auth/server';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const revalidate = 0;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Public creator channel. Anyone can view; auth only affects the bottom nav
 * "perfil" destination and the self-visit guard on the follow button.
 *
 * The URL slug is the creator's lowercased 0x address — handles ship in
 * Sprint 3+ alongside the handle registry.
 */
export default async function CreatorPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = await params;
  if (!ADDRESS_RE.test(raw)) notFound();
  const address = raw.toLowerCase() as `0x${string}`;

  const [session, liveInputs] = await Promise.all([
    readAeviaSession().catch(() => null),
    listLiveInputs().catch(() => []),
  ]);

  // Filter by creator — mirrors the dashboard ownership filter, minus the
  // self-only constraint. We accept both `meta.creatorAddress` (our mirror)
  // and `defaultCreator` (Cloudflare's canonical field, often null) so
  // backfilled legacy records still surface.
  const owned = liveInputs.filter((l) => {
    const metaCreator = l.meta?.creatorAddress?.toLowerCase();
    const defaultCreator = l.defaultCreator?.toLowerCase();
    return metaCreator === address || defaultCreator === address;
  });

  // Sort newest first.
  owned.sort((a, b) => (a.created < b.created ? 1 : -1));

  // Derive display name — first non-empty `meta.creator` across lives,
  // falling back to the short address. The displayed value uses the raw
  // `meta.creator` (usually the creator's email) without lowercasing so
  // the @handle line preserves the signed-up casing.
  const displayName = owned.find((l) => l.meta?.creator)?.meta?.creator ?? shortAddress(address);

  // Last on-chain register block across all lives — feeds the manifesto
  // terminal line. `null` when no live has been registered yet.
  let lastRegisterBlock: number | null = null;
  for (const l of owned) {
    const block = l.meta?.registerBlock ? Number(l.meta.registerBlock) : undefined;
    if (block !== undefined && (lastRegisterBlock === null || block > lastRegisterBlock)) {
      lastRegisterBlock = block;
    }
  }

  const lives: CreatorLive[] = owned.map((l) => {
    const durationSeconds = l.status?.current?.state === 'connected' ? null : null;
    const recordingUid = l.meta?.recordingVideoUid;
    const thumbnailUrl = streamThumbnailUrl(recordingUid, { height: 360 });

    return {
      uid: l.uid,
      name: l.meta?.name ?? 'sem título',
      state: (l.status?.current?.state as CreatorLive['state']) ?? 'unknown',
      createdISO: l.created,
      thumbnailUrl,
      durationSeconds,
      manifestCid: l.meta?.manifestCid,
      registerBlock: l.meta?.registerBlock ? Number(l.meta.registerBlock) : undefined,
      registerTxHash: l.meta?.registerTxHash,
    };
  });

  return (
    <CreatorScreen
      address={address}
      did={addressToDid(address, 84532)}
      shortAddress={shortAddress(address)}
      displayName={displayName}
      lastRegisterBlock={lastRegisterBlock}
      lives={lives}
      viewerAddress={session?.address ?? null}
    />
  );
}
