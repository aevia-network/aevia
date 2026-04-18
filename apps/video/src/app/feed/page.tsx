import { FeedScreen, type LiveCard } from '@/components/feed-screen';
import { listLiveInputs } from '@/lib/cloudflare/stream-client';
import { shortAddress } from '@aevia/auth';
import { readAeviaSession } from '@aevia/auth/server';

export const runtime = 'edge';
export const revalidate = 0;

/**
 * Consumer Home Feed. Public (readable without a session); the chrome surfaces
 * a sign-in call-to-action via the wallet chip when `viewer` is null.
 *
 * Mirrors Stitch screen `659db837da83412298c0e1a9f2c1f1b6` ("Aevia — Home Feed
 * (Harmonized)"). Sprint 2 scope:
 *
 * - REAL: "ao vivo agora" carousel, sourced from `listLiveInputs()` filtered
 *   to `status.current.state === 'connected'`. Viewer counts are unknown
 *   server-side (Cloudflare Stream does not expose a live count on GET), so
 *   the card omits the count until Provider Node telemetry lands.
 * - MOCK with honest framing: curatorial editorial card, feed posts
 *   (reactions + presence), creators grid. All labelled "pré-curadoria"
 *   and fed from a constant so the replacement with a real feed table in
 *   Sprint 3 is a one-file diff.
 * - MOCK chrome: peers counter, wallet credits badge.
 */
export default async function FeedPage() {
  const [session, liveInputs] = await Promise.all([
    readAeviaSession().catch(() => null),
    listLiveInputs().catch(() => []),
  ]);

  const lives: LiveCard[] = liveInputs
    .filter((l) => l.status?.current?.state === 'connected')
    .sort((a, b) => (a.created < b.created ? 1 : -1))
    .slice(0, 8)
    .map((l) => {
      const recordingUid = l.meta?.recordingVideoUid;
      const thumbnailUrl = recordingUid
        ? `https://customer-ysi6k7bkk9rfd5sa.cloudflarestream.com/${recordingUid}/thumbnails/thumbnail.jpg?time=1s&height=360`
        : null;
      const creatorAddress = (l.meta?.creatorAddress ?? l.defaultCreator ?? '').toLowerCase();
      return {
        uid: l.uid,
        title: l.meta?.name ?? 'sem título',
        creatorDisplayName:
          l.meta?.creator ??
          (creatorAddress ? shortAddress(creatorAddress as `0x${string}`) : 'aevia'),
        creatorAddress: creatorAddress || null,
        thumbnailUrl,
      };
    });

  return (
    <FeedScreen
      viewer={
        session
          ? {
              address: session.address,
              shortAddress: shortAddress(session.address),
              displayName: session.displayName,
            }
          : null
      }
      lives={lives}
    />
  );
}
