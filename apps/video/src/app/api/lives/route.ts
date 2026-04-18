import { createLiveInput } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Live input creation. The matching `GET` handler was removed in 2026-04-18 —
 * every consumer (feed, dashboard, discover, creators, creator/[address])
 * fetches `listLiveInputs()` server-side directly and the route had drifted
 * from the canonical `meta.creatorAddress || defaultCreator` ownership pattern
 * used in `_lib/register-meta.ts`.
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

  try {
    const live = await createLiveInput({
      creatorAddress: session.address,
      creatorDisplayName: session.displayName,
      creatorDid: session.did,
      title,
    });
    return NextResponse.json(
      {
        uid: live.uid,
        whipUrl: live.webRTC.url,
        whepUrl: live.webRTCPlayback.url,
        creator: session.displayName,
        creatorAddress: session.address,
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
