import { PlayerScreen } from '@/components/player-screen';
import {
  getLivepeerStream,
  livepeerPlaybackUrl,
  livepeerPlayerUrl,
} from '@/lib/livepeer/stream-client';
import { shortAddress } from '@aevia/auth';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Livepeer viewer. The id in the URL is a naked Livepeer stream UID
 * (no `lp:` prefix — we use the route segment to disambiguate, mirroring
 * the `/live/mesh/[id]` pattern that already exists for aevia-mesh).
 *
 * Why a separate route segment instead of a prefix on `/live/[id]`:
 * the `:` separator in `lp:UUID` got URL-encoded somewhere in the
 * Cloudflare Workers + next-on-pages routing layer, breaking
 * `id.startsWith('lp:')` and falling through to the Cloudflare path
 * (which 404s because the id isn't a CF uid). Using a clean URL
 * segment side-steps the encoding entirely.
 */
export default async function LivepeerViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const stream = await getLivepeerStream(id);
  if (!stream) notFound();

  // Livepeer doesn't expose a Cloudflare-style `state` enum. We mirror
  // `isActive` to PlayerScreen's existing live↔vod toggle so no
  // per-backend branching leaks into the viewer.
  const userTags = (stream as { userTags?: Record<string, string> }).userTags ?? {};
  const isActive = (stream as { isActive?: boolean }).isActive ?? false;
  const state = isActive ? 'connected' : 'disconnected';
  const creatorAddress = userTags.creatorAddress as `0x${string}` | undefined;
  const creatorDid = userTags.creatorDid;

  return (
    <PlayerScreen
      uid={stream.id}
      title={stream.name}
      whepUrl={livepeerPlaybackUrl(stream.playbackId)}
      hlsUrl={null}
      aeviaHlsUrl={null}
      aeviaWhepUrl={null}
      backend="livepeer"
      livepeerPlayerUrl={livepeerPlayerUrl(stream.playbackId)}
      vodProcessing={false}
      creatorDisplayName={creatorDid ?? (creatorAddress ? shortAddress(creatorAddress) : 'aevia')}
      creatorAddress={creatorAddress ?? null}
      state={state}
      startedISO={new Date(stream.createdAt).toISOString()}
      manifestCid={null}
      registerBlock={null}
      registerTxHash={null}
    />
  );
}
