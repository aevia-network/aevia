import { PlayerScreen } from '@/components/player-screen';
import {
  getLiveInput,
  getVideo,
  listLiveInputVideos,
  updateVideo,
} from '@/lib/cloudflare/stream-client';
import type { StreamVideo } from '@/lib/cloudflare/types';
import { shortAddress } from '@aevia/auth';
import { notFound } from 'next/navigation';

export const runtime = 'edge';

export default async function LiveViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let live: Awaited<ReturnType<typeof getLiveInput>>;
  try {
    live = await getLiveInput(id);
  } catch {
    notFound();
  }

  const state = live.status?.current?.state ?? 'unknown';

  // VOD resolution priority (when broadcaster disconnected):
  // 1. If the live_input's meta carries a recordingVideoUid, we uploaded a
  //    client-side recording; fetch it and use its playback.hls.
  // 2. Fallback: list videos Cloudflare auto-generated (works only once WHIP
  //    recording lands upstream; today always empty for WHIP ingest).
  let vodHlsUrl: string | null = null;
  let vodProcessing = false;

  if (state !== 'connected') {
    const recordingUid = live.meta?.recordingVideoUid;

    if (recordingUid) {
      try {
        const video = await getVideo(recordingUid);
        if (video.readyToStream && video.status.state === 'ready') {
          await ensurePublicPlayback(video);
          vodHlsUrl = video.playback.hls;
        } else {
          vodProcessing = true;
        }
      } catch {
        // Video was deleted or unreachable — fall through to auto-recordings lookup.
      }
    }

    if (!vodHlsUrl && !vodProcessing) {
      try {
        const videos = await listLiveInputVideos(id);
        const ready = videos
          .filter((v) => v.readyToStream && v.status.state === 'ready')
          .sort((a, b) => (a.created < b.created ? 1 : -1))[0];
        if (ready) {
          await ensurePublicPlayback(ready);
          vodHlsUrl = ready.playback.hls;
        } else if (videos.length > 0) {
          vodProcessing = true;
        }
      } catch {
        // Non-fatal — viewer renders graceful "nenhuma gravação" state.
      }
    }
  }

  const creatorAddress = (
    (live.meta?.creatorAddress ?? live.defaultCreator ?? '') as string
  ).toLowerCase() as `0x${string}` | '';
  const creatorDisplayName =
    live.meta?.creator ??
    (creatorAddress ? shortAddress(creatorAddress as `0x${string}`) : 'aevia');

  return (
    <PlayerScreen
      uid={live.uid}
      title={live.meta?.name ?? 'sem título'}
      whepUrl={live.webRTCPlayback.url}
      hlsUrl={vodHlsUrl}
      aeviaHlsUrl={null}
      aeviaWhepUrl={null}
      backend="cloudflare"
      vodProcessing={vodProcessing}
      creatorDisplayName={creatorDisplayName}
      creatorAddress={creatorAddress || null}
      state={state}
      startedISO={live.created}
      manifestCid={live.meta?.manifestCid ?? null}
      registerBlock={live.meta?.registerBlock ? Number(live.meta.registerBlock) : null}
      registerTxHash={live.meta?.registerTxHash ?? null}
    />
  );
}

/**
 * Lazy-fix for legacy videos that were uploaded before the link-recording
 * route started PATCHing `requireSignedURLs: false`. Cloudflare's tus
 * `requiresignedurls` metadata key is interpreted as truthy regardless of
 * value, so the resulting video inherits the account default — commonly
 * `true`, which makes the public HLS manifest return 401 to viewers.
 *
 * Mutates the in-memory `video.requireSignedURLs` so the same render that
 * triggered the patch reads the corrected state immediately. Failure is
 * non-fatal: the playback URL still surfaces, and the next render retries.
 */
async function ensurePublicPlayback(video: StreamVideo): Promise<void> {
  if (video.requireSignedURLs === false) return;
  try {
    await updateVideo(video.uid, { requireSignedURLs: false });
    video.requireSignedURLs = false;
  } catch {
    // Swallow — viewer may hit 401 once; the next request retries the patch.
  }
}
