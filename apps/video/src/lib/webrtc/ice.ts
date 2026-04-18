export async function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs = 2000,
): Promise<void> {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, timeoutMs);
    function check() {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    }
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

/**
 * Fetch ICE servers (STUN + Cloudflare TURN credentials when configured)
 * from the same-origin `/api/webrtc/ice-servers` route. Falls back to the
 * static `DEFAULT_ICE_SERVERS` when the route fails — never throws, so
 * callers can always proceed with at least direct/STUN connectivity.
 *
 * Why fetch instead of hardcoding: Cloudflare Realtime TURN credentials
 * are short-lived (1h TTL) and per-account-secret. They MUST be minted
 * server-side and rotated. The route is cached for ~50 min, so the round
 * trip happens at most once per session window.
 */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/webrtc/ice-servers', {
      method: 'GET',
      // Allow the browser cache to serve repeat calls within the TTL window.
      cache: 'default',
    });
    if (!res.ok) return DEFAULT_ICE_SERVERS;
    const body = (await res.json()) as { iceServers?: RTCIceServer[] };
    if (!body.iceServers || body.iceServers.length === 0) return DEFAULT_ICE_SERVERS;
    return body.iceServers;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}
