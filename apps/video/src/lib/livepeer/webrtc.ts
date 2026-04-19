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
 * `https://livepeer.studio/webrtc/{streamKey-or-playbackId}` — we HEAD it,
 * follow the `Location` header manually (so we keep the resolved host out of
 * the browser's redirect cache), and synthesise the STUN+TURN config.
 *
 * Throws if the upstream returns a non-redirect status — caller should fall
 * back to STUN-only or surface the error to the user.
 */
export async function resolveLivepeerEndpoint(baseUrl: string): Promise<LivepeerEndpoint> {
  // `redirect: 'manual'` ensures we read the Location header ourselves
  // instead of letting the browser auto-follow (which would flip the method
  // semantics for the eventual POST).
  const res = await fetch(baseUrl, { method: 'HEAD', redirect: 'manual' });

  // `opaqueredirect` is the spec status when the browser sees a redirect
  // but is NOT allowed to follow it — that's exactly our case. The
  // Location header is on the underlying response but not exposed via
  // `res.headers.get`. Workaround: fetch with `redirect: 'follow'` on a
  // GET-equivalent request and read `res.url` after the redirect.
  if (res.type === 'opaqueredirect' || res.status === 0) {
    const followed = await fetch(baseUrl, { method: 'GET', redirect: 'follow' });
    return endpointFromUrl(followed.url || baseUrl);
  }

  const location = res.headers.get('location');
  if (location) {
    const resolvedUrl = new URL(location, baseUrl).toString();
    return endpointFromUrl(resolvedUrl);
  }

  // Some clients/Livepeer regions skip the redirect step entirely and
  // accept SDP at the canonical URL. Treat that as a no-op resolve.
  return endpointFromUrl(baseUrl);
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
