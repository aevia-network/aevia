import { createDirectUpload, getLiveInput } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Issue a Cloudflare Stream Direct Creator Upload URL for the caller.
 *
 * The client uploads the MediaRecorder blob directly to Cloudflare via the
 * returned `uploadUrl` (tus protocol), bypassing the Worker request-body cap
 * and removing double-bandwidth through our edge. Once the upload finishes
 * the client calls `/link-recording` with the `videoUid` we return here.
 *
 * Auth: Privy session cookie.
 * Ownership: only the live's `defaultCreator` may request an upload URL.
 * Body: `{ uploadLength: number }` — required by tus; we forward it as
 * `Upload-Length` to Cloudflare.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readAeviaSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: liveInputId } = await context.params;

  const live = await getLiveInput(liveInputId).catch(() => null);
  if (!live) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // Lowercase-compare — Cloudflare echoes whatever was stored, while session
  // addresses are normalised to lowercase in `@aevia/auth`.
  if ((live.defaultCreator ?? '').toLowerCase() !== session.address.toLowerCase()) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let uploadLength: number;
  try {
    const body = (await request.json()) as { uploadLength?: unknown };
    const raw = typeof body.uploadLength === 'number' ? body.uploadLength : Number.NaN;
    if (!Number.isFinite(raw) || raw <= 0 || raw > 5 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'uploadLength must be a positive number ≤ 5 GiB' },
        { status: 400 },
      );
    }
    uploadLength = Math.floor(raw);
  } catch {
    return NextResponse.json({ error: 'uploadLength required in JSON body' }, { status: 400 });
  }

  try {
    const { uploadUrl, videoUid } = await createDirectUpload({
      liveInputId,
      creatorAddress: session.address,
      creatorDisplayName: session.displayName,
      creatorDid: session.did,
      uploadLength,
    });
    return NextResponse.json({ uploadUrl, videoUid }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
