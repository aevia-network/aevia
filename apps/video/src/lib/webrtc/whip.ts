/**
 * WHIP (WebRTC-HTTP Ingestion Protocol) client.
 * Cloudflare Stream docs: https://developers.cloudflare.com/stream/webrtc-beta/
 * Spec: https://datatracker.ietf.org/doc/draft-ietf-wish-whip/
 */

import { DEFAULT_ICE_SERVERS, waitForIceGatheringComplete } from './ice';

export interface WhipSession {
  pc: RTCPeerConnection;
  resourceUrl: string | null;
  /**
   * Session ID returned by Aevia provider-node via the `X-Aevia-Session-ID`
   * response header. `null` when publishing to Cloudflare Stream (which has
   * no equivalent header; the uid comes from the prior POST /api/lives).
   */
  sessionId: string | null;
  stop: () => Promise<void>;
}

export interface WhipOptions {
  whipUrl: string;
  stream: MediaStream;
  iceServers?: RTCIceServer[];
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  /** Optional DID to send in `X-Aevia-DID` for provider-node allowlists. */
  did?: string;
  /**
   * Optional wallet signer. When provided, the client signs the
   * outgoing SDP offer via EIP-191 (personal_sign) before POSTing it,
   * and sends the 65-byte (r||s||v) 0x-hex signature as
   * `X-Aevia-Signature`. The provider-node recovers the address from
   * the signature and verifies it matches the DID's address.
   *
   * Typical sources:
   *   - Privy `useSignMessage` hook (prod)
   *   - `null` in the dev-bypass path (server accepts unsigned)
   */
  sign?: (message: string) => Promise<string>;
  /**
   * Cap for the video encoder's max bitrate in bits/sec, applied ONLY when
   * the simulcast path is unavailable (browser rejects sendEncodings). With
   * simulcast active the per-layer `maxBitrate` in `simulcastLayers` is the
   * real ceiling. Default 1.5 Mbps. Pass 0 to opt out of the legacy cap.
   */
  maxVideoBitrate?: number;
  /**
   * Simulcast layers to publish. The browser sends one RTP stream per layer
   * at the specified resolution scale + max bitrate, the Cloudflare SFU
   * consumes them all, and each viewer gets the layer matching their network.
   *
   * When omitted, defaults via `defaultSimulcastLayers()` — desktop UAs get
   * 3 layers (q/h/f up to 2 Mbps), mobile UAs get 2 layers (q/h up to 800 Kbps)
   * to fit cellular uplink budgets. Pass `[]` to disable simulcast and fall
   * back to the legacy single-encoding + `maxVideoBitrate` cap path.
   */
  simulcastLayers?: SimulcastLayer[];
}

/** Default cap applied when `WhipOptions.maxVideoBitrate` is unset. */
export const DEFAULT_MAX_VIDEO_BITRATE = 1_500_000;

/**
 * Simulcast layer profile. Each entry becomes one `RTCRtpEncodingParameters`
 * passed to `addTransceiver({ sendEncodings })`. The browser publishes one
 * RTP stream per layer at the chosen resolution scale + max bitrate, the
 * Cloudflare Realtime SFU consumes all of them, and each subscriber gets
 * the layer matching its bandwidth — automatically downgraded when the
 * link degrades, automatically upgraded when it recovers.
 *
 * `rid` follows the convention shipping in the wider WHIP/WebRTC ecosystem:
 *   q (quarter) — lowest, ~4× smaller resolution
 *   h (half)    — middle, ~2× smaller resolution
 *   f (full)    — top, native capture resolution
 */
export interface SimulcastLayer {
  rid: 'q' | 'h' | 'f';
  maxBitrate: number;
  scaleResolutionDownBy: number;
}

const DESKTOP_LAYERS: SimulcastLayer[] = [
  { rid: 'q', maxBitrate: 300_000, scaleResolutionDownBy: 4 }, // ~360p
  { rid: 'h', maxBitrate: 800_000, scaleResolutionDownBy: 2 }, // ~720p
  { rid: 'f', maxBitrate: 2_000_000, scaleResolutionDownBy: 1 }, // ~1080p
];

const MOBILE_LAYERS: SimulcastLayer[] = [
  { rid: 'q', maxBitrate: 200_000, scaleResolutionDownBy: 4 }, // ~360p
  { rid: 'h', maxBitrate: 600_000, scaleResolutionDownBy: 2 }, // ~720p
  // No `f` on mobile — uplink budget on 4G/5G can't afford the 2 Mbps top
  // layer reliably. Viewers still get adaptive playback between the two.
];

/**
 * Pick simulcast layers based on the publisher's user agent. Mobile browsers
 * get a 2-layer profile capped at ~800 Kbps total to fit Vivo/Claro/Tim 4G
 * uplinks; desktop browsers get the full 3-layer profile up to ~2 Mbps. The
 * publisher's bandwidth is the bottleneck for simulcast — the SFU can only
 * forward layers it actually receives.
 *
 * Override via `WhipOptions.simulcastLayers` when the caller has a more
 * specific signal (e.g., a network-quality preview before going live).
 */
export function defaultSimulcastLayers(): SimulcastLayer[] {
  if (typeof navigator === 'undefined') return DESKTOP_LAYERS;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isMobile ? MOBILE_LAYERS : DESKTOP_LAYERS;
}

export async function publishWhip(opts: WhipOptions): Promise<WhipSession> {
  const pc = new RTCPeerConnection({
    iceServers: opts.iceServers ?? DEFAULT_ICE_SERVERS,
    bundlePolicy: 'max-bundle',
  });

  if (opts.onConnectionStateChange) {
    pc.addEventListener('connectionstatechange', () => {
      opts.onConnectionStateChange?.(pc.connectionState);
    });
  }

  const layers = opts.simulcastLayers ?? defaultSimulcastLayers();
  const fallbackCap = opts.maxVideoBitrate ?? DEFAULT_MAX_VIDEO_BITRATE;

  for (const track of opts.stream.getTracks()) {
    if (track.kind === 'video' && layers.length > 0) {
      // Simulcast path: publish multiple resolutions in parallel so the SFU
      // can layer-switch per subscriber. Browsers that don't support the
      // sendEncodings option silently drop the extra layers and behave like
      // single-layer publishers — the catch below is the safety net.
      try {
        pc.addTransceiver(track, {
          direction: 'sendonly',
          streams: [opts.stream],
          sendEncodings: layers.map((l) => ({
            rid: l.rid,
            maxBitrate: l.maxBitrate,
            scaleResolutionDownBy: l.scaleResolutionDownBy,
          })),
        });
        continue;
      } catch (err) {
        // Older browsers (or strict typings on edge runtimes) reject
        // sendEncodings on the init dictionary. Fall through to the
        // legacy single-encoding setup — viewer still gets a stream.
        console.warn('[whip] simulcast init rejected, falling back to single layer', err);
      }
    }

    const transceiver = pc.addTransceiver(track, {
      direction: 'sendonly',
      streams: [opts.stream],
    });
    if (fallbackCap > 0 && track.kind === 'video') {
      try {
        const params = transceiver.sender.getParameters();
        const encodings = params.encodings && params.encodings.length > 0 ? params.encodings : [{}];
        encodings[0] = { ...encodings[0], maxBitrate: fallbackCap };
        params.encodings = encodings;
        await transceiver.sender.setParameters(params);
      } catch {
        // Non-fatal — some browsers reject setParameters before
        // negotiation, or refuse the specific field. Stream still
        // works, just without the soft cap.
      }
    }
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete(pc);

  const offerSdp = pc.localDescription?.sdp ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/sdp' };
  if (opts.did) headers['X-Aevia-DID'] = opts.did;
  if (opts.sign && offerSdp) {
    try {
      const sig = await opts.sign(offerSdp);
      headers['X-Aevia-Signature'] = sig.startsWith('0x') ? sig : `0x${sig}`;
    } catch (err) {
      // Non-fatal for back-compat — if the wallet refuses to sign we
      // still try the POST. Providers with RequireSignatures=true will
      // reject 401, surfacing the problem downstream.
      console.warn('[whip] sign() failed, posting without signature', err);
    }
  }

  const res = await fetch(opts.whipUrl, {
    method: 'POST',
    headers,
    body: offerSdp,
  });

  if (!res.ok) {
    pc.close();
    throw new Error(`WHIP publish failed: ${res.status} ${await res.text()}`);
  }

  const answerSdp = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  const resourceUrl = res.headers.get('Location');
  const absoluteResourceUrl = resourceUrl ? new URL(resourceUrl, opts.whipUrl).toString() : null;
  const sessionId = res.headers.get('X-Aevia-Session-ID');

  const stop = async () => {
    try {
      if (absoluteResourceUrl) {
        await fetch(absoluteResourceUrl, { method: 'DELETE' }).catch(() => undefined);
      }
    } finally {
      pc.close();
    }
  };

  return { pc, resourceUrl: absoluteResourceUrl, sessionId, stop };
}
