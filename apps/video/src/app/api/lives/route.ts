import { createLiveInput } from '@/lib/cloudflare/stream-client';
import {
  createLivepeerStream,
  livepeerIngestUrl,
  livepeerPlaybackUrl,
  livepeerPlayerUrl,
} from '@/lib/livepeer/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

type LiveBackend = 'cloudflare' | 'aevia-mesh' | 'livepeer';

/**
 * Live input creation. The caller picks the backend per broadcast:
 *
 *   - `cloudflare` (default): classic Stream live input — WHIP + WHEP
 *     URLs come from Cloudflare. Per-minute subscribed billing; works
 *     well for low-to-medium fan-out broadcasts where the managed CDN
 *     reach matters more than unit economics.
 *
 *   - `aevia-mesh`: zero-Cloudflare path. Browser posts WHIP directly
 *     to the mesh URL published via `NEXT_PUBLIC_AEVIA_MESH_URL`; the
 *     provider-node mints the sessionID via the X-Aevia-Session-ID
 *     response header. Soberania total — no managed dependency.
 *
 *   - `livepeer`: decentralised public network. Stream is created via
 *     Livepeer Studio API (server-side, this route) and the client gets
 *     a streamKey-based WHIP URL + playbackId-based WHEP URL. Per-minute
 *     ENCODED ingest billing (not per-minute SUBSCRIBED) — at high viewer
 *     fan-out the unit economics flip in our favour by ~100x. Recording
 *     is handled by Livepeer; no separate VOD upload needed.
 *     Decision rationale: see OPPORTUNITY.md §6.
 *
 * The UI on /live/new shows a radio that sets `body.backend`. If omitted
 * we fall back to cloudflare — safest default while the alternatives are
 * gated behind explicit env-var feature flags (mesh = NEXT_PUBLIC_AEVIA_MESH_URL,
 * livepeer = NEXT_PUBLIC_LIVEPEER_AVAILABLE + LIVEPEER_API_KEY).
 *
 * Live ID conventions: Cloudflare and aevia-mesh return naked UIDs.
 * Livepeer prefixes its UID with `lp:` so the per-live routes can
 * dispatch reads to the right backend without a separate lookup table.
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
    if (body.backend === 'aevia-mesh' || body.backend === 'livepeer') backend = body.backend;
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
        playbackId: null,
        playerUrl: null,
        creator: session.displayName,
        creatorAddress: session.address,
        creatorDid: session.did,
        title: title ?? null,
      },
      { status: 201 },
    );
  }

  if (backend === 'livepeer') {
    try {
      const nameSlug = session.displayName.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 16) || 'aevia';
      const stream = await createLivepeerStream({
        name: title?.slice(0, 80) ?? `aevia-${nameSlug}-${Date.now()}`,
        creatorAddress: session.address,
        creatorDid: session.did,
        record: true,
      });
      return NextResponse.json(
        {
          backend,
          // Prefix with `lp:` so /live/[id] routes know to dispatch reads
          // to the Livepeer client rather than the Cloudflare client.
          uid: `lp:${stream.id}`,
          whipUrl: livepeerIngestUrl(stream.streamKey),
          whepUrl: livepeerPlaybackUrl(stream.playbackId),
          hlsBaseUrl: null,
          playbackId: stream.playbackId,
          playerUrl: livepeerPlayerUrl(stream.playbackId),
          creator: session.displayName,
          creatorAddress: session.address,
          creatorDid: session.did,
          title: title ?? stream.name,
        },
        { status: 201 },
      );
    } catch (err) {
      console.error('[lives:livepeer] create failed', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'livepeer create failed' },
        { status: 502 },
      );
    }
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
        playbackId: null,
        playerUrl: null,
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
