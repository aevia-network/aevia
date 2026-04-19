/**
 * Short-lived bearer tokens scoped to a single live input + publisher role.
 *
 * Minted by the studio when a creator opts to broadcast via an external
 * tool (OBS Studio 30+, etc.) and validated by the WHIP proxy route. The
 * token replaces the ambient Privy cookie session — OBS / ffmpeg / curl
 * do not carry browser cookies, so we hand them a JWT they can plug into
 * `Authorization: Bearer <token>`.
 *
 * Security model:
 *   - HS256 signed with `AEVIA_PUBLISHER_TOKEN_SECRET` (server-only env).
 *     Never exposed to the client; minting requires a Privy session AND
 *     an ownership check on the live input.
 *   - 30-minute default TTL — long enough for a human to copy/paste into
 *     OBS and start a broadcast, short enough that a leaked token rolls
 *     over inside one event window. Rotation/revocation lives in the
 *     follow-up slice (sprint item 2 — TODO §10 OPPORTUNITY §1.2).
 *   - `jti` (JWT ID) is a random 16-byte value so future revocation can
 *     blacklist a specific token without bumping the signing secret.
 *   - Claims are minimal: `liveId`, `role: 'publisher'`, `iat`, `exp`,
 *     `jti`. No PII, no DID — the WHIP proxy only needs to know which
 *     live input the bearer is allowed to publish to.
 */

import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const DEFAULT_TTL_SECONDS = 30 * 60; // 30 minutes
const ISSUER = 'aevia-video';
const AUDIENCE = 'aevia-whip';

export interface PublisherTokenClaims {
  /** Live input UID this token authorises. Must match the route param at verify time. */
  liveId: string;
  role: 'publisher';
  /** issued-at, seconds since epoch */
  iat: number;
  /** expires-at, seconds since epoch */
  exp: number;
  /** JWT ID — random 16-byte hex, enables future per-token revocation. */
  jti: string;
}

function signingKey(): Uint8Array {
  const secret = process.env.AEVIA_PUBLISHER_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AEVIA_PUBLISHER_TOKEN_SECRET must be set and >= 32 chars. See SETUP.md.');
  }
  return new TextEncoder().encode(secret);
}

function randomJti(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function mintPublisherToken(opts: {
  liveId: string;
  ttlSeconds?: number;
}): Promise<{ token: string; expiresAt: number; jti: string }> {
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;
  const jti = randomJti();

  const token = await new SignJWT({ liveId: opts.liveId, role: 'publisher' })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(signingKey());

  return { token, expiresAt: exp, jti };
}

export async function verifyPublisherToken(token: string): Promise<PublisherTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
    });
    if (
      typeof payload.liveId === 'string' &&
      payload.role === 'publisher' &&
      typeof payload.iat === 'number' &&
      typeof payload.exp === 'number' &&
      typeof payload.jti === 'string'
    ) {
      return {
        liveId: payload.liveId,
        role: 'publisher',
        iat: payload.iat,
        exp: payload.exp,
        jti: payload.jti,
      };
    }
    return null;
  } catch {
    // Expired, signature mismatch, malformed JWT — all collapse to null.
    // Callers respond with 401; we never leak the failure mode.
    return null;
  }
}
