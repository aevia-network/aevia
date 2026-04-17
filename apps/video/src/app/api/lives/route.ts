import { createLiveInput, listLiveInputs } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mine = url.searchParams.get('mine') === '1';

  const session = mine ? await readAeviaSession() : null;
  if (mine && !session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const lives = await listLiveInputs();
    const filtered = mine
      ? lives.filter((l) => l.defaultCreator === session?.address)
      : lives.filter((l) => l.status?.current?.state === 'connected');

    const shaped = filtered.map((l) => ({
      uid: l.uid,
      creator: l.meta?.creator ?? l.defaultCreator ?? 'unknown',
      creatorAddress: l.defaultCreator ?? null,
      name: l.meta?.name ?? '',
      created: l.created,
      state: l.status?.current?.state ?? 'disconnected',
    }));
    return NextResponse.json({ lives: shaped }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await readAeviaSession();
  if (!session) {
    console.error('[api/lives POST] readAeviaSession returned null');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  console.error(`[api/lives POST] session ok userId=${session.userId}`);

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
