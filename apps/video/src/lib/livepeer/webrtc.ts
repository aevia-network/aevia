/**
 * Browser-side helpers for Livepeer's WHIP/WHEP flow.
 *
 * Why this is its own helper instead of plumbing into `lib/webrtc/whip.ts`:
 * Livepeer's WebRTC ingest/playback URLs are GeoDNS-routed via a HEAD
 * redirect. The browser must follow the redirect explicitly (it doesn't
 * happen transparently for POST), and the `Location` host then becomes
 * the source of the ICE servers (Livepeer's own STUN/TURN, not our
 * Cloudflare Realtime TURN). This pattern is specific enough that
 * branching it inside `publishWhip` / `playWhep` would muddy the
 * Cloudflare-default code path.
 *
 * Reference: https://docs.livepeer.org/developers/guides/broadcast-via-webrtc
 *            https://docs.livepeer.org/developers/guides/playback-webrtc
 */

export interface LivepeerEndpoint {
  /** Geo-routed URL the SDP POST must hit. Different per request — Livepeer
   *  resolves to the closest POP (LAX, FRA, MIA, etc.). */
  url: string;
  /** ICE servers derived from the resolved host. Livepeer's STUN/TURN under
   *  shared "livepeer" credentials — fine for short-lived broadcast/playback
   *  sessions per their public docs. */
  iceServers: RTCIceServer[];
}

/**
 * Resolve a Livepeer WHIP/WHEP base URL into the geo-routed endpoint and
 * matching ICE servers. The base URL takes the form
 * `https://livepeer.studio/webrtc/{streamKey-or-playbackId}`.
 *
 * We HEAD it with the default `redirect: 'follow'` so the browser
 * transparently chases the 302 to the closest POP. `res.url` after the
 * fetch carries the final URL, from which we extract the host for ICE
 * config. The previous `redirect: 'manual'` + GET fallback path produced
 * a 405 Method Not Allowed against `livepeer.studio/webrtc/{key}` (only
 * accepts POST/HEAD/DELETE) — visible in browser console even though
 * the broadcast itself worked because the bad GET response carried the
 * resolved POP URL anyway.
 */
export async function resolveLivepeerEndpoint(baseUrl: string): Promise<LivepeerEndpoint> {
  try {
    const res = await fetch(baseUrl, { method: 'HEAD' });
    return endpointFromUrl(res.url || baseUrl);
  } catch {
    // Network error before redirect chain completes — return canonical URL.
    // Livepeer will still route server-side; the only loss is geo-optimal
    // ICE selection (we'll get whatever STUN/TURN the canonical host serves).
    return endpointFromUrl(baseUrl);
  }
}

function endpointFromUrl(url: string): LivepeerEndpoint {
  const host = new URL(url).host;
  return {
    url,
    iceServers: [
      { urls: `stun:${host}` },
      // Public Livepeer TURN credentials are documented in their broadcast
      // guide. Short-lived per-session relay is fine here — the credentials
      // do not authorise anything beyond the live session URL we already
      // hold (and the POST below has no auth header of its own).
      {
        urls: `turn:${host}`,
        username: 'livepeer',
        credential: 'livepeer',
      },
    ],
  };
}
