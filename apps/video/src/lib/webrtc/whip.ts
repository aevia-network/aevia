/**
 * WHIP (WebRTC-HTTP Ingestion Protocol) client.
 * Cloudflare Stream docs: https://developers.cloudflare.com/stream/webrtc-beta/
 * Spec: https://datatracker.ietf.org/doc/draft-ietf-wish-whip/
 */

import { DEFAULT_ICE_SERVERS, waitForIceGatheringComplete } from './ice';

export interface WhipSession {
  pc: RTCPeerConnection;
  resourceUrl: string | null;
  stop: () => Promise<void>;
}

export interface WhipOptions {
  whipUrl: string;
  stream: MediaStream;
  iceServers?: RTCIceServer[];
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
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

  for (const track of opts.stream.getTracks()) {
    pc.addTransceiver(track, { direction: 'sendonly', streams: [opts.stream] });
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete(pc);

  const res = await fetch(opts.whipUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
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

  const stop = async () => {
    try {
      if (absoluteResourceUrl) {
        await fetch(absoluteResourceUrl, { method: 'DELETE' }).catch(() => undefined);
      }
    } finally {
      pc.close();
    }
  };

  return { pc, resourceUrl: absoluteResourceUrl, stop };
}
