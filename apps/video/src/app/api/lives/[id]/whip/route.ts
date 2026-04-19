import { getLiveInput } from '@/lib/cloudflare/stream-client';
import { verifyPublisherToken } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Authenticated WHIP proxy. Sits in front of the Cloudflare Stream WHIP
 * endpoint so external broadcasters (OBS Studio 30+, ffmpeg, etc.) can
 * publish without ever seeing the underlying CF live input URL.
 *
 * Why proxy instead of redirecting to the CF URL directly:
 *   - The CF Stream WHIP URL embeds an opaque stream key — anyone with the
 *     URL can publish. We never want to hand that to a caster's clipboard.
 *   - Bearer-token auth gives us scoping (per-live, per-role) and a 30-min
 *     TTL window. Rotation/revocation can happen on our side without
 *     rotating the underlying CF stream.
 *   - We get a single audit point for "who started/stopped which live"
 *     without instrumenting CF webhooks.
 *
 * Auth model:
 *   - `Authorization: Bearer <jwt>` required on POST and DELETE.
 *   - Token's `liveId` claim must match the route param. Rejected with 403
 *     otherwise — prevents a token minted for live A from posting to live B.
 *
 * Protocol notes:
 *   - WHIP is HTTP POST + Content-Type `application/sdp`. We forward the
 *     raw SDP body and content-type to CF; CF answers with 201 + SDP body
 *     + Location header pointing at the WHIP resource (used for DELETE).
 *   - We pass the CF Location header through unchanged. The caster's
 *     library follows it directly to terminate the session. This leaks
 *     the CF resource URL in one header, but the caster never types it
 *     and OBS doesn't display it; for the security-vs-complexity trade
 *     this is acceptable until we have KV-backed resource mapping.
 *   - OPTIONS handler answers CORS preflights for browser-based WHIP
 *     clients (curl, ffmpeg, OBS don't preflight, but a future web UI
 *     might if we expose a self-broadcast page from a different origin).
 */

const ALLOWED_METHODS = 'POST, DELETE, OPTIONS';
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': ALLOWED_METHODS,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Link',
  'Access-Control-Expose-Headers': 'Location, ETag',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(status = 204): Response {
  return new Response(null, { status, headers: CORS_HEADERS });
}

function unauthorized(reason: string): Response {
  return NextResponse.json(
    { error: 'unauthorized', reason },
    { status: 401, headers: CORS_HEADERS },
  );
}

async function authorise(
  req: Request,
  expectedLiveId: string,
): Promise<{ ok: true } | { ok: false; res: Response }> {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, res: unauthorized('missing bearer token') };

  const token = match[1];
  if (!token) return { ok: false, res: unauthorized('missing bearer token') };
  const claims = await verifyPublisherToken(token);
  if (!claims) return { ok: false, res: unauthorized('invalid or expired token') };
  if (claims.liveId !== expectedLiveId) {
    return { ok: false, res: unauthorized('token scope mismatch') };
  }
  return { ok: true };
}

export function OPTIONS(): Response {
  return corsResponse(204);
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await authorise(req, id);
  if (!auth.ok) return auth.res;

  let live: Awaited<ReturnType<typeof getLiveInput>>;
  try {
    live = await getLiveInput(id);
  } catch (err) {
    console.error('[whip-proxy] live lookup failed', { id, err });
    return NextResponse.json({ error: 'live not found' }, { status: 404, headers: CORS_HEADERS });
  }

  const upstreamUrl = live.webRTC?.url;
  if (!upstreamUrl) {
    return NextResponse.json(
      { error: 'live has no WHIP endpoint' },
      { status: 502, headers: CORS_HEADERS },
    );
  }

  const sdp = await req.text();
  const upstream = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': req.headers.get('content-type') ?? 'application/sdp',
    },
    body: sdp,
  });

  const answer = await upstream.text();
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', upstream.headers.get('content-type') ?? 'application/sdp');
  // Pass through Location so the caster library can DELETE the resource
  // when the session ends. We currently forward the raw CF resource URL —
  // see jsdoc above for the trade-off rationale.
  const location = upstream.headers.get('location');
  if (location) headers.set('Location', location);
  const etag = upstream.headers.get('etag');
  if (etag) headers.set('ETag', etag);

  return new Response(answer, { status: upstream.status, headers });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await authorise(req, id);
  if (!auth.ok) return auth.res;

  // Some WHIP clients DELETE the route URL itself instead of following
  // Location; in that case we can't know which resource to terminate
  // without KV mapping. For now we accept the no-op (CF auto-detects
  // session termination via packet timeout in ~30s) and log it.
  console.log('[whip-proxy] DELETE on route URL — relying on CF idle timeout', { id });
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}
