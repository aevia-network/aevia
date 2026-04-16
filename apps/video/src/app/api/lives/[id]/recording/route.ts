import { getLiveInput, updateLiveInput, uploadVideoBlob } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Accept a multipart blob recorded client-side (MediaRecorder) and upload it to
 * Cloudflare Stream as a VOD. Associates the resulting video UID with the
 * originating live input via `meta.recordingVideoUid` so that
 * /live/[id] can surface the replay later.
 *
 * Expected form-data: `file` (Blob). Request size capped ~100 MiB by Workers
 * request body limits.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readAeviaSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: liveInputId } = await context.params;

  // Ownership check — only the live's creator may upload its recording.
  const live = await getLiveInput(liveInputId).catch(() => null);
  if (!live || live.defaultCreator !== session.address) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let file: File | null;
  try {
    const form = await request.formData();
    const f = form.get('file');
    file = f instanceof File ? f : null;
  } catch (err) {
    return NextResponse.json(
      { error: `invalid form-data: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 400 },
    );
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  try {
    const video = await uploadVideoBlob(file, {
      liveInputId,
      creator: session.displayName,
      creatorAddress: session.address,
      creatorDid: session.did,
      source: 'whip-client-recorder',
    });

    await updateLiveInput(liveInputId, {
      meta: { recordingVideoUid: video.uid },
    });

    return NextResponse.json(
      {
        videoUid: video.uid,
        status: video.status.state,
        readyToStream: video.readyToStream,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
