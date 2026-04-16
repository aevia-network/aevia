import { createLiveInput, listLiveInputs } from '@/lib/cloudflare/stream-client';
import { readSession } from '@/lib/session/cookie';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mine = url.searchParams.get('mine') === '1';

  const session = mine ? await readSession() : null;
  if (mine && !session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const lives = await listLiveInputs();
    const filtered = mine
      ? lives.filter((l) => l.defaultCreator === session?.handle)
      : lives.filter((l) => l.status?.current?.state === 'connected');

    const shaped = filtered.map((l) => ({
      uid: l.uid,
      creator: l.defaultCreator ?? l.meta?.creator ?? 'unknown',
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
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let title: string | undefined;
  try {
    const body = (await request.json()) as { title?: string };
    title = body.title;
  } catch {
    // body is optional
  }

  try {
    const live = await createLiveInput({
      creatorHandle: session.handle,
      title,
    });
    return NextResponse.json(
      {
        uid: live.uid,
        whipUrl: live.webRTC.url,
        whepUrl: live.webRTCPlayback.url,
        creator: session.handle,
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
