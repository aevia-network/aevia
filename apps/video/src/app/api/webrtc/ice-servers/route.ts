import { getRealtimeTurnEnv } from '@/lib/env';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const STUN_ONLY_ICE_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
] as const;

/**
 * Return STUN-only credentials with an explicit reason, so callers can still
 * attempt direct/STUN connectivity and ops can grep the relay tag in logs to
 * count abuse-rejection vs. config-failure events.
 */
function stunOnly(reason: 'unauthenticated' | 'unavailable' | 'mint-failed', maxAge: number) {
  return NextResponse.json(
    { iceServers: STUN_ONLY_ICE_SERVERS, relay: reason },
    {
      status: 200,
      headers: {
        // STUN list is static, but cache short so a flip in env or auth state
        // is reflected within seconds — never minutes.
        'cache-control': `public, max-age=${maxAge}`,
      },
    },
  );
}

/**
 * Mint short-lived ICE server credentials backed by Cloudflare Realtime TURN.
 *
 * WHIP (publish) and WHEP (subscribe) clients fetch this endpoint immediately
 * before opening their `RTCPeerConnection` so the resulting peer carries TURN
 * relay candidates as a fallback when direct host/STUN candidates fail. This
 * is the fix for the Vivo 4G failure mode reported 2026-04-18: CGNAT +
 * UDP-throttling combine to make raw WebRTC handshakes time out, but TURN
 * relay over TCP/443 to a Cloudflare edge POP routes around both.
 *
 * Cost note: TURN traffic that flows between Cloudflare Realtime and
 * Cloudflare Stream WHIP/WHEP is NOT double-billed (per CF Realtime pricing
 * docs). Stream sessions therefore inherit free TURN relay under the
 * Stream-included Realtime quota; standalone usage is $0.05/GB outbound after
 * the 1 TB/month Realtime free tier.
 *
 * Auth: requires a valid Aevia session (Privy id-token cookie or dev-bypass).
 * TURN credentials are short-lived and bound to the configured TURN key, but
 * still represent paid relay bandwidth — gating prevents random callers from
 * minting creds for non-Aevia traffic. Unauthenticated callers receive a
 * STUN-only payload so the public viewer surface can still attempt direct
 * connectivity, while signed-in publishers/viewers get the full relay set.
 */
export async function GET() {
  const session = await readAeviaSession();
  if (!session) {
    // Don't expose paid TURN bandwidth to anonymous callers. STUN-only is
    // safe to ship publicly — no credential leak, no per-byte cost.
    return stunOnly('unauthenticated', 60);
  }

  const turn = getRealtimeTurnEnv();
  if (!turn) {
    // Soft fallback — without TURN config, return STUN-only so the client
    // can still attempt direct connectivity. This is what the player has
    // been doing all along; the route just acknowledges the gap explicitly.
    return stunOnly('unavailable', 60);
  }

  // Cloudflare Realtime TURN credential mint endpoint.
  // Reference: https://developers.cloudflare.com/realtime/turn/generate-credentials/
  // Returns an `iceServers` block ready to plug into RTCPeerConnection config.
  const ttl = 3600; // 1 hour. CF accepts up to 86400 (24h) but shorter = blast-radius cap.
  const upstream = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${turn.CLOUDFLARE_REALTIME_TURN_TOKEN_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${turn.CLOUDFLARE_REALTIME_TURN_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl }),
    },
  );

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => '');
    // Don't crash the page — surface STUN-only so playback still tries direct
    // connectivity. Log so ops can spot a misconfigured/expired TURN key.
    console.error(`[ice-servers] CF TURN mint failed: ${upstream.status} ${body.slice(0, 200)}`);
    return stunOnly('mint-failed', 0);
  }

  const payload = (await upstream.json()) as {
    iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  };

  // CF returns an array of entries: one for STUN-only, one (or more) carrying
  // TURN URLs across every transport (UDP/3478, TCP/3478, TLS/5349, plus
  // alternative ports 53/80/443 for hostile firewalls). Pass through unchanged
  // — the browser tries candidates in order and short-circuits on the first
  // pair that survives the consent check.
  return NextResponse.json(
    { iceServers: payload.iceServers, relay: 'cloudflare', ttl },
    {
      status: 200,
      headers: {
        // Cache for slightly less than the credential TTL so a fresh call
        // never returns expired creds. ttl=3600 → cache 3000s → first stale
        // re-validation 10 min before expiry. `private` so the CF edge cache
        // doesn't leak one publisher's creds to another caller.
        'cache-control': `private, max-age=${Math.max(60, ttl - 600)}`,
      },
    },
  );
}
