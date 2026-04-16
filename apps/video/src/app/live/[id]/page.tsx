import { getLiveInput, getVideo, listLiveInputVideos } from '@/lib/cloudflare/stream-client';
import { notFound } from 'next/navigation';
import { Viewer } from './viewer';

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
          vodHlsUrl = ready.playback.hls;
        } else if (videos.length > 0) {
          vodProcessing = true;
        }
      } catch {
        // Non-fatal — viewer renders graceful "nenhuma gravação" state.
      }
    }
  }

  return (
    <Viewer
      uid={live.uid}
      whepUrl={live.webRTCPlayback.url}
      hlsUrl={vodHlsUrl}
      vodProcessing={vodProcessing}
      creator={live.defaultCreator ?? live.meta?.creator ?? 'anonymous'}
      state={state}
    />
  );
}
