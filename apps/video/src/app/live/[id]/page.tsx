import { getLiveInput, listLiveInputVideos } from '@/lib/cloudflare/stream-client';
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

  // When the broadcaster is no longer connected, try to surface the VOD of the
  // most recent finished recording. Cloudflare produces a separate video entity
  // for each recording; its playback.hls URL is stable once readyToStream.
  let vodHlsUrl: string | null = null;
  let vodProcessing = false;

  if (state !== 'connected') {
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
      // Non-fatal — viewer will show a graceful "replay não disponível" state.
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
