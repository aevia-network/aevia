import { resolveLiveOwnership } from '@/app/api/lives/[id]/_lib/register-meta';
import { clientEnv } from '@/lib/env';
import { mintPublisherToken, readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Mint a 30-minute bearer token scoped to a single live input + publisher
 * role. The studio UI calls this when the creator opts to broadcast via OBS
 * (or any external WHIP tool). The returned `{token, ingestUrl, expiresAt}`
 * triple is what the user copy-pastes into OBS:
 *
 *   Settings → Stream → Service: WHIP
 *   Server: <ingestUrl>
 *   Bearer Token: <token>
 *
 * Auth model:
 *   - Privy session cookie required (anonymous callers get 401).
 *   - Live input ownership is verified via `resolveLiveOwnership`, the same
 *     canonical helper used by `actions.ts` and the registration routes.
 *     This guarantees a token can only be minted for a live the caller owns.
 *
 * Token rotation/revocation lives in the follow-up slice (sprint item 2 —
 * OPPORTUNITY §1.2). For now, each call mints a fresh token; the previous
 * one stays valid until its 30-min TTL expires.
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readAeviaSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const ownership = await resolveLiveOwnership(id, session.address);
  if (!ownership) {
    return NextResponse.json({ error: 'live not found' }, { status: 404 });
  }
  if (!ownership.owned) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let mint: { token: string; expiresAt: number; jti: string };
  try {
    mint = await mintPublisherToken({ liveId: id });
  } catch (err) {
    // Most likely cause: AEVIA_PUBLISHER_TOKEN_SECRET unset on this deploy.
    console.error('[publisher-token] mint failed', err);
    return NextResponse.json(
      { error: 'publisher tokens not configured on this deployment' },
      { status: 503 },
    );
  }

  // Public WHIP ingest URL the caster plugs into OBS. Always points at our
  // edge route (not the Cloudflare Stream WHIP URL directly) so the token
  // is verified before we proxy upstream.
  const baseUrl = clientEnv.appUrl.replace(/\/+$/, '');
  const ingestUrl = `${baseUrl}/api/lives/${id}/whip`;

  return NextResponse.json(
    {
      token: mint.token,
      jti: mint.jti,
      expiresAt: mint.expiresAt,
      ingestUrl,
      // Surface the live's existing meta so the studio UI can show
      // a contextual confirmation ("token for: <name>") without a
      // second round-trip.
      liveId: id,
      liveName: ownership.live.meta?.name ?? null,
    },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
}
