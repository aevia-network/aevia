import { getLiveInput, getVideo, updateLiveInput } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Persist the association between a live input and the VOD that resulted from
 * its client-side recording. Called by the Upload Context after tus reports
 * success.
 *
 * This is the fallback path for Cloudflare Stream's webhook-based linking —
 * once webhook-secret wiring lands, this route becomes redundant but remains
 * harmless as an idempotent no-op.
 *
 * Auth: Privy session cookie.
 * Ownership: only the live's `defaultCreator` may link a recording.
 * Idempotency: if `meta.recordingVideoUid` already equals the incoming
 * `videoUid`, return 200 without a write.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readAeviaSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: liveInputId } = await context.params;

  let videoUid: string;
  try {
    const body = (await request.json()) as { videoUid?: unknown };
    if (typeof body.videoUid !== 'string' || body.videoUid.length === 0) {
      return NextResponse.json({ error: 'videoUid required' }, { status: 400 });
    }
    videoUid = body.videoUid;
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
  }

  const live = await getLiveInput(liveInputId).catch(() => null);
  if (!live) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if ((live.defaultCreator ?? '').toLowerCase() !== session.address.toLowerCase()) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Idempotent no-op — avoids a Stream API round-trip when the client retries.
  if (live.meta?.recordingVideoUid === videoUid) {
    return NextResponse.json({ videoUid, linked: true, already: true }, { status: 200 });
  }

  // Confirm the video exists and belongs to this account before writing meta.
  // `getVideo` throws on 404/403 — propagate as a 400 so the client knows the
  // upload didn't actually land on Cloudflare.
  try {
    await getVideo(videoUid);
  } catch (err) {
    return NextResponse.json(
      { error: `video not found: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 400 },
    );
  }

  try {
    await updateLiveInput(liveInputId, { meta: { recordingVideoUid: videoUid } });
    return NextResponse.json({ videoUid, linked: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
