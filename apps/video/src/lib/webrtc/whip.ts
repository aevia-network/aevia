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
   * Cap for the video encoder's max bitrate in bits/sec (passed to
   * `RTCRtpSender.setParameters()`). Limiting the ceiling smooths
   * Chrome's bandwidth-adaptation ramp — without a cap the encoder
   * swings resolution aggressively during the first ~10s of a
   * session, forcing SPS changes our CMAF segmenter has to cope with.
   * Default 1.5 Mbps — enough for 720p30 Constrained Baseline. Pass 0
   * to opt out.
   */
  maxVideoBitrate?: number;
}

/** Default cap applied when `WhipOptions.maxVideoBitrate` is unset. */
export const DEFAULT_MAX_VIDEO_BITRATE = 1_500_000;

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

  const capBitrate = opts.maxVideoBitrate ?? DEFAULT_MAX_VIDEO_BITRATE;
  for (const track of opts.stream.getTracks()) {
    const transceiver = pc.addTransceiver(track, {
      direction: 'sendonly',
      streams: [opts.stream],
    });
    if (capBitrate > 0 && track.kind === 'video') {
      try {
        const params = transceiver.sender.getParameters();
        const encodings = params.encodings && params.encodings.length > 0 ? params.encodings : [{}];
        encodings[0] = { ...encodings[0], maxBitrate: capBitrate };
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

  const headers: Record<string, string> = { 'Content-Type': 'application/sdp' };
  if (opts.did) headers['X-Aevia-DID'] = opts.did;

  const res = await fetch(opts.whipUrl, {
    method: 'POST',
    headers,
    body: pc.localDescription?.sdp ?? '',
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
