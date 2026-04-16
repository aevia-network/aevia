/**
 * WHEP (WebRTC-HTTP Egress Protocol) client.
 * Spec: https://datatracker.ietf.org/doc/draft-murillo-whep/
 */

import { DEFAULT_ICE_SERVERS, waitForIceGatheringComplete } from './ice';

export interface WhepSession {
  pc: RTCPeerConnection;
  stream: MediaStream;
  resourceUrl: string | null;
  stop: () => Promise<void>;
}

export interface WhepOptions {
  whepUrl: string;
  iceServers?: RTCIceServer[];
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onTrack?: (event: RTCTrackEvent) => void;
}

export async function playWhep(opts: WhepOptions): Promise<WhepSession> {
  const pc = new RTCPeerConnection({
    iceServers: opts.iceServers ?? DEFAULT_ICE_SERVERS,
    bundlePolicy: 'max-bundle',
  });

  const remoteStream = new MediaStream();

  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });

  pc.addEventListener('track', (event) => {
    for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
      remoteStream.addTrack(track);
    }
    opts.onTrack?.(event);
  });

  if (opts.onConnectionStateChange) {
    pc.addEventListener('connectionstatechange', () => {
      opts.onConnectionStateChange?.(pc.connectionState);
    });
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete(pc);

  const res = await fetch(opts.whepUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription?.sdp ?? '',
  });

  if (!res.ok) {
    pc.close();
    throw new Error(`WHEP play failed: ${res.status} ${await res.text()}`);
  }

  const answerSdp = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  const resourceUrl = res.headers.get('Location');
  const absoluteResourceUrl = resourceUrl ? new URL(resourceUrl, opts.whepUrl).toString() : null;

  const stop = async () => {
    try {
      if (absoluteResourceUrl) {
        await fetch(absoluteResourceUrl, { method: 'DELETE' }).catch(() => undefined);
      }
    } finally {
      pc.close();
    }
  };

  return { pc, stream: remoteStream, resourceUrl: absoluteResourceUrl, stop };
}
