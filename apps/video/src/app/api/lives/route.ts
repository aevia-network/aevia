import { createLiveInput } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Live input creation. Two backends:
 *
 *   1. **Provider-node mesh** (M8 zero-Cloudflare): when `PROVIDER_BASE_URL`
 *      is set, we just echo the WHIP endpoint; the browser POSTs SDP
 *      directly to the node, which mints the sessionID and returns it via
 *      the `X-Aevia-Session-ID` header. No Cloudflare round-trip.
 *
 *   2. **Cloudflare Stream** (legacy): original path, `createLiveInput`
 *      mints a uid and returns WHIP/WHEP URLs Cloudflare owns.
 *
 * The GET handler was removed 2026-04-18 — feed/dashboard/discover fetch
 * `listLiveInputs()` server-side directly.
 */
export async function POST(request: Request) {
  const session = await readAeviaSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let title: string | undefined;
  try {
    const body = (await request.json()) as { title?: string };
    title = body.title;
  } catch {
    // body optional
  }

  const providerBase = process.env.PROVIDER_BASE_URL?.trim();
  if (providerBase) {
    // Aevia provider-node path. The `uid` is deferred — it's the sessionID
    // the node will mint when the browser posts SDP. Client fills it in
    // from the WHIP response header.
    return NextResponse.json(
      {
        backend: 'aevia-mesh',
        uid: null,
        whipUrl: `${providerBase.replace(/\/+$/, '')}/whip`,
        whepUrl: null,
        hlsBaseUrl: providerBase.replace(/\/+$/, ''),
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
        backend: 'cloudflare-stream',
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
