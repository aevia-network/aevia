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

/**
 * Inspect the active ICE candidate-pair on a connected `RTCPeerConnection`
 * to detect whether TURN relay was needed for this peer. Logs once with a
 * structured payload and, when relay was the path, an extra plain-language
 * line that's easy to grep in deploy logs:
 *   `[<tag>:turn] viewer connected via TURN relay (direct path failed; ...)`
 *
 * Three outcomes per local `candidateType`:
 *   - `host` / `srflx` / `prflx` — direct connectivity, TURN not used
 *   - `relay`                    — TURN saved the session (Vivo 4G class)
 *   - undefined / no pair        — race during teardown; we log nothing
 *
 * Production logs are intentional and uncostly (one log per session). The
 * relay-vs-direct ratio over time is the metric that surfaces the
 * universal-network gap Cloudflare Stream beta alone doesn't close.
 *
 * Call from `connectionstatechange` once `pc.connectionState === 'connected'`.
 */
export async function inspectCandidatePair(
  pc: RTCPeerConnection,
  tag: 'whip' | 'whep',
): Promise<void> {
  try {
    const stats = await pc.getStats();
    let pair: RTCIceCandidatePairStats | undefined;
    for (const report of stats.values()) {
      if (report.type !== 'candidate-pair') continue;
      const cp = report as RTCIceCandidatePairStats;
      if (cp.state === 'succeeded' && cp.nominated) {
        pair = cp;
        break;
      }
    }
    if (!pair) return;

    // RTCIceCandidateStats isn't in the default DOM lib on every TS version;
    // its only field we care about is `candidateType` ('host' | 'srflx' |
    // 'prflx' | 'relay'), so a structural cast keeps this portable.
    const local = stats.get(pair.localCandidateId) as { candidateType?: string } | undefined;
    const remote = stats.get(pair.remoteCandidateId) as { candidateType?: string } | undefined;
    const localType = local?.candidateType ?? 'unknown';
    const remoteType = remote?.candidateType ?? 'unknown';
    const usedTurn = localType === 'relay' || remoteType === 'relay';

    // biome-ignore lint/suspicious/noConsoleLog: intentional telemetry — see jsdoc
    console.log(`[${tag}:ice]`, { localType, remoteType, usedTurn });
    if (usedTurn) {
      // biome-ignore lint/suspicious/noConsoleLog: intentional telemetry — see jsdoc
      console.log(
        `[${tag}:turn] viewer connected via TURN relay (direct path failed; relay saved this session)`,
      );
    }
  } catch {
    // getStats can briefly reject during teardown; nothing to do.
  }
}
