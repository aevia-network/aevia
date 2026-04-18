import { getRealtimeTurnEnv } from '@/lib/env';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

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
 * Auth: this endpoint is public on purpose — credentials are scoped to a
 * single TTL window (default 1 h) and bound to the TURN key, so leaking one
 * minted set is bounded. To prevent abuse (random callers minting credentials
 * for non-Aevia traffic) we will add Privy-session gating + rate-limit at the
 * Cloudflare edge in a follow-up; out of scope for the immediate Vivo 4G fix.
 */
export async function GET() {
  const turn = getRealtimeTurnEnv();
  if (!turn) {
    // Soft fallback — without TURN config, return STUN-only so the client
    // can still attempt direct connectivity. This is what the player has
    // been doing all along; the route just acknowledges the gap explicitly.
    return NextResponse.json(
      {
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
        relay: 'unavailable',
      },
      {
        status: 200,
        headers: {
          // Short cache — STUN list is static, but we want the server to be
          // able to flip to relay-on the moment the env flips.
          'cache-control': 'public, max-age=60',
        },
      },
    );
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
    return NextResponse.json(
      {
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
        relay: 'mint-failed',
      },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
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
        // re-validation 10 min before expiry.
        'cache-control': `private, max-age=${Math.max(60, ttl - 600)}`,
      },
    },
  );
}
