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

  // Livepeer's `isActive` flag lags behind the actual ingest by several
  // seconds — when a creator hits "go live" and a viewer opens the page
  // immediately after, the SSR fetch sees `isActive: false` even though
  // packets are already flowing. Mirroring that into PlayerScreen as
  // `state='disconnected'` would route the viewer into VOD mode and skip
  // the WHEP attempt entirely (we pass `hlsUrl: null` for Livepeer because
  // the recording is only available post-broadcast).
  //
  // Force `state='connected'` so PlayerScreen always tries WHEP first.
  // The Livepeer playback endpoint accepts the SDP POST whether the stream
  // is technically "active" or not — if there's nothing to play yet, the
  // existing `onConnectionStateChange === 'failed'` branch surfaces the
  // error. False positives ("connecting…" with no broadcaster) are a
  // smaller UX regression than false negatives (signal exists but viewer
  // sees a black screen with no retry path).
  const userTags = (stream as { userTags?: Record<string, string> }).userTags ?? {};
  const creatorAddress = userTags.creatorAddress as `0x${string}` | undefined;
  const creatorDid = userTags.creatorDid;
  const state = 'connected';

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
