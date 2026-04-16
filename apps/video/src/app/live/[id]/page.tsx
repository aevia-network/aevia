import { getLiveInput } from '@/lib/cloudflare/stream-client';
import { notFound } from 'next/navigation';
import { Viewer } from './viewer';

export const runtime = 'edge';

export default async function LiveViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const live = await getLiveInput(id);
    return (
      <Viewer
        uid={live.uid}
        whepUrl={live.webRTCPlayback.url}
        creator={live.defaultCreator ?? live.meta?.creator ?? 'anonymous'}
        state={live.status?.current?.state ?? 'unknown'}
      />
    );
  } catch {
    notFound();
  }
}
