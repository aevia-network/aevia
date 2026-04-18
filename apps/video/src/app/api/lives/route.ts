import { createLiveInput } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

type LiveBackend = 'cloudflare' | 'aevia-mesh';

/**
 * Live input creation. The caller picks the backend per broadcast:
 *
 *   - `cloudflare` (default): classic Stream live input — WHIP + WHEP
 *     URLs come from Cloudflare.
 *   - `aevia-mesh`: zero-Cloudflare path. Browser posts WHIP directly
 *     to the mesh URL published via `NEXT_PUBLIC_AEVIA_MESH_URL`; the
 *     provider-node mints the sessionID via the X-Aevia-Session-ID
 *     response header. No Cloudflare round-trip.
 *
 * The UI on /live/new shows a radio that sets `body.backend`. If omitted
 * we fall back to cloudflare — safest default while the mesh is
 * experimental.
 */
export async function POST(request: Request) {
  const session = await readAeviaSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let title: string | undefined;
  let backend: LiveBackend = 'cloudflare';
  try {
    const body = (await request.json()) as { title?: string; backend?: LiveBackend };
    title = body.title;
    if (body.backend === 'aevia-mesh') backend = 'aevia-mesh';
  } catch {
    // body optional
  }

  if (backend === 'aevia-mesh') {
    const meshUrl = process.env.NEXT_PUBLIC_AEVIA_MESH_URL?.trim();
    if (!meshUrl) {
      return NextResponse.json(
        { error: 'mesh backend not configured on this deployment' },
        { status: 400 },
      );
    }
    const base = meshUrl.replace(/\/+$/, '');
    return NextResponse.json(
      {
        backend,
        uid: null, // provider-node mints it at WHIP time
        whipUrl: `${base}/whip`,
        whepUrl: null,
        hlsBaseUrl: base,
        creator: session.displayName,
        creatorAddress: session.address,
        creatorDid: session.did,
        title: title ?? null,
      },
      { status: 201 },
    );
  }

  try {
    const live = await createLiveInput({
      creatorAddress: session.address,
      creatorDisplayName: session.displayName,
      creatorDid: session.did,
      title,
    });
    return NextResponse.json(
      {
        backend,
        uid: live.uid,
        whipUrl: live.webRTC.url,
        whepUrl: live.webRTCPlayback.url,
        hlsBaseUrl: null,
        creator: session.displayName,
        creatorAddress: session.address,
        creatorDid: session.did,
        title: title ?? null,
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
