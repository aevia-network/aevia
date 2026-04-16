import { deleteLiveInput, deleteVideo, getLiveInput } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const live = await getLiveInput(id);
    return NextResponse.json(
      {
        uid: live.uid,
        whepUrl: live.webRTCPlayback.url,
        whipUrl: live.webRTC.url,
        creator: live.meta?.creator ?? live.defaultCreator ?? 'unknown',
        creatorAddress: live.defaultCreator ?? null,
        name: live.meta?.name ?? '',
        state: live.status?.current?.state ?? 'unknown',
        created: live.created,
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readAeviaSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;
  try {
    const live = await getLiveInput(id).catch(() => null);
    if (!live || live.defaultCreator !== session.address) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const recordingVideoUid = live.meta?.recordingVideoUid;
    if (recordingVideoUid) {
      await deleteVideo(recordingVideoUid).catch(() => undefined);
    }
    await deleteLiveInput(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
