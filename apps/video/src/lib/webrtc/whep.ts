/**
 * WHEP (WebRTC-HTTP Egress Protocol) client.
 * Spec: https://datatracker.ietf.org/doc/draft-murillo-whep/
 *
 * Fase 2.1b instrumentation: every session reports timing milestones
 * via an optional `onMetrics` callback. The user-facing latency that
 * validates the "melhor que CDN" thesis IS the consumption-side number
 * (mirror → viewer), and without client-side timing we can't observe
 * it. When `debug=1` is passed to the page, a lightweight console
 * summary is printed at first decoded frame.
 */

import { DEFAULT_ICE_SERVERS, inspectCandidatePair, waitForIceGatheringComplete } from './ice';

export interface WhepSession {
  pc: RTCPeerConnection;
  stream: MediaStream;
  resourceUrl: string | null;
  stop: () => Promise<void>;
}

/**
 * Timing milestones collected from the moment playWhep is invoked
 * through to the first decoded video frame. All numbers are
 * performance.now() at the moment the milestone was reached — so
 * they share a common origin and differences are meaningful.
 */
export interface WhepTimings {
  /** performance.now() when playWhep started. */
  tStart: number;
  /** createOffer + setLocalDescription completed. */
  tOfferReady: number;
  /** ICE gathering (full, no trickle) completed. */
  tIceGathered: number;
  /** Server responded to POST /whep with 2xx + SDP body. */
  tSdpAnswerReceived: number;
  /** setRemoteDescription resolved — our PC is fully configured. */
  tSdpAnswerApplied: number;
  /**
   * RTCPeerConnection.connectionState flipped to 'connected' — ICE
   * + DTLS + SRTP all green. Unset until it happens; may be undefined
   * if the session never connects before stop().
   */
  tIceConnected?: number;
  /** First ontrack event fired. Usually video track. */
  tFirstTrack?: number;
  /**
   * getStats().framesDecoded rolled over 0 — the viewer has a real
   * decoded frame in memory. This is the closest proxy for
   * "pixel on screen" without touching the video element directly.
   */
  tFirstFrameDecoded?: number;
}

/**
 * Derived durations — what the reader actually cares about. Each
 * number is the delta between two milestones. undefined when the
 * upstream milestone hasn't fired yet.
 */
export interface WhepLatencyBudget {
  /** createOffer → answer in hand. Measures our SDP handshake. */
  sdpHandshakeMs?: number;
  /** Time ICE spent gathering candidates (full, non-trickle mode). */
  iceGatheringMs?: number;
  /** Time from SDP answer applied to RTCPeerConnection 'connected'. */
  iceConnectivityMs?: number;
  /** From ICE connected to first ontrack. Usually tiny (<50ms). */
  trackArrivalMs?: number;
  /** From first track to first decoded frame. Browser jitter buffer. */
  decodeStartMs?: number;
  /**
   * From playWhep() call to first decoded frame. THE headline number:
   * "how long until my viewer sees the creator". Covers SDP + ICE +
   * first packet + jitter buffer + decode.
   */
  totalTimeToFirstFrameMs?: number;
}

export interface WhepMetrics {
  timings: WhepTimings;
  budget: WhepLatencyBudget;
}

export interface WhepOptions {
  whepUrl: string;
  iceServers?: RTCIceServer[];
  /**
   * Overrides the default ICE transport policy. Pass `'relay'` to force
   * every candidate through TURN — useful as a stability band-aid on
   * networks where peer-reflexive + host pairs prove fragile (mobile 4G,
   * CGNAT, symmetric NAT). Pass `'all'` to allow direct-first with TURN
   * fallback. Default is `'all'` to preserve latency on healthy paths;
   * callers that know they're on a hostile network should override.
   */
  iceTransportPolicy?: RTCIceTransportPolicy;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onTrack?: (event: RTCTrackEvent) => void;
  /**
   * Fires twice: once when the PC reaches 'connected' (with tIceConnected
   * + tFirstTrack populated), and once when first frame is decoded (with
   * the full budget). Emit what you have each time — late milestones may
   * be undefined on the first emit.
   */
  onMetrics?: (metrics: WhepMetrics) => void;
  /**
   * When true, logs a summary table to console on both emit events.
   * Callers typically pass `new URLSearchParams(location.search).get('debug') === '1'`
   * so dev inspection is URL-driven, invisible in prod.
   */
  debugLog?: boolean;
  /**
   * When true, the session's `stop()` skips the DELETE on the WHEP resource
   * URL and just closes the local RTCPeerConnection. Use for backends whose
   * resource URLs are on origins that don't return permissive CORS headers
   * for cross-origin DELETE — Livepeer POPs in particular. See WHIP twin
   * for the same trade-off rationale.
   */
  skipResourceDelete?: boolean;
}

export async function playWhep(opts: WhepOptions): Promise<WhepSession> {
  const timings: WhepTimings = {
    tStart: performance.now(),
    tOfferReady: 0,
    tIceGathered: 0,
    tSdpAnswerReceived: 0,
    tSdpAnswerApplied: 0,
  };

  const pc = new RTCPeerConnection({
    iceServers: opts.iceServers ?? DEFAULT_ICE_SERVERS,
    iceTransportPolicy: opts.iceTransportPolicy ?? 'all',
    bundlePolicy: 'max-bundle',
  });

  const remoteStream = new MediaStream();
  let firstTrackEvent: RTCTrackEvent | null = null;
  let firstFrameDecodedAt: number | undefined;
  let pollHandle: number | undefined;

  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });

  pc.addEventListener('track', (event) => {
    if (!firstTrackEvent) {
      firstTrackEvent = event;
      timings.tFirstTrack = performance.now();
    }
    for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
      remoteStream.addTrack(track);
    }
    opts.onTrack?.(event);
  });

  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'connected' && timings.tIceConnected === undefined) {
      timings.tIceConnected = performance.now();
      emit(opts, timings, firstFrameDecodedAt);
      startFirstFrameProbe(pc, timings, opts, (at) => {
        firstFrameDecodedAt = at;
      });
      // Telemetry: did TURN relay save this viewer? See ice.ts jsdoc.
      void inspectCandidatePair(pc, 'whep');
    }
    opts.onConnectionStateChange?.(pc.connectionState);
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  timings.tOfferReady = performance.now();

  await waitForIceGatheringComplete(pc);
  timings.tIceGathered = performance.now();

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
  timings.tSdpAnswerReceived = performance.now();

  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  timings.tSdpAnswerApplied = performance.now();

  const resourceUrl = res.headers.get('Location');
  const absoluteResourceUrl = resourceUrl ? new URL(resourceUrl, opts.whepUrl).toString() : null;

  const stop = async () => {
    if (pollHandle !== undefined) {
      clearInterval(pollHandle);
      pollHandle = undefined;
    }
    try {
      if (absoluteResourceUrl && !opts.skipResourceDelete) {
        await fetch(absoluteResourceUrl, { method: 'DELETE' }).catch(() => undefined);
      }
    } finally {
      pc.close();
    }
  };

  return { pc, stream: remoteStream, resourceUrl: absoluteResourceUrl, stop };
}

/**
 * Poll getStats() every 100ms until we see framesDecoded > 0 on an
 * inbound video track. When that happens, stamp tFirstFrameDecoded
 * and emit the final metrics payload. Stops polling after 30s to
 * avoid leaking when a session never produces video (edge case but
 * real — slow handshake, upstream hub not yet populated).
 */
function startFirstFrameProbe(
  pc: RTCPeerConnection,
  timings: WhepTimings,
  opts: WhepOptions,
  onDecoded: (at: number) => void,
): void {
  const deadline = performance.now() + 30_000;
  const interval = setInterval(async () => {
    if (performance.now() > deadline || pc.connectionState === 'closed') {
      clearInterval(interval);
      return;
    }
    try {
      const stats = await pc.getStats();
      for (const report of stats.values()) {
        if (
          report.type === 'inbound-rtp' &&
          (report as RTCInboundRtpStreamStats).kind === 'video'
        ) {
          const framesDecoded = (report as RTCInboundRtpStreamStats & { framesDecoded?: number })
            .framesDecoded;
          if (framesDecoded && framesDecoded > 0) {
            const now = performance.now();
            timings.tFirstFrameDecoded = now;
            onDecoded(now);
            emit(opts, timings, now);
            clearInterval(interval);
            return;
          }
        }
      }
    } catch {
      // getStats can reject briefly during teardown; ignore and retry.
    }
  }, 100);
}

function emit(opts: WhepOptions, timings: WhepTimings, firstFrameAt?: number): void {
  const budget = computeBudget(timings);
  opts.onMetrics?.({ timings, budget });
  if (opts.debugLog) {
    logBudget(timings, budget, firstFrameAt !== undefined);
  }
}

/** Pure derivation — exported so callers can re-compute from persisted timings. */
export function computeBudget(t: WhepTimings): WhepLatencyBudget {
  const budget: WhepLatencyBudget = {
    sdpHandshakeMs: t.tSdpAnswerReceived > 0 ? t.tSdpAnswerReceived - t.tStart : undefined,
    iceGatheringMs: t.tIceGathered > 0 ? t.tIceGathered - t.tOfferReady : undefined,
    iceConnectivityMs:
      t.tIceConnected !== undefined ? t.tIceConnected - t.tSdpAnswerApplied : undefined,
    trackArrivalMs:
      t.tFirstTrack !== undefined && t.tIceConnected !== undefined
        ? t.tFirstTrack - t.tIceConnected
        : undefined,
    decodeStartMs:
      t.tFirstFrameDecoded !== undefined && t.tFirstTrack !== undefined
        ? t.tFirstFrameDecoded - t.tFirstTrack
        : undefined,
    totalTimeToFirstFrameMs:
      t.tFirstFrameDecoded !== undefined ? t.tFirstFrameDecoded - t.tStart : undefined,
  };
  return budget;
}

function logBudget(t: WhepTimings, budget: WhepLatencyBudget, final: boolean): void {
  const tag = final ? 'whep:first-frame' : 'whep:connected';
  // biome-ignore lint/suspicious/noConsoleLog: intentional debug instrumentation gated behind debug=1
  console.log(`[${tag}]`, {
    sdpHandshakeMs: round(budget.sdpHandshakeMs),
    iceGatheringMs: round(budget.iceGatheringMs),
    iceConnectivityMs: round(budget.iceConnectivityMs),
    trackArrivalMs: round(budget.trackArrivalMs),
    decodeStartMs: round(budget.decodeStartMs),
    totalTimeToFirstFrameMs: round(budget.totalTimeToFirstFrameMs),
    rawTimings: {
      start: round(t.tStart),
      offerReady: round(t.tOfferReady),
      iceGathered: round(t.tIceGathered),
      sdpAnswerReceived: round(t.tSdpAnswerReceived),
      sdpAnswerApplied: round(t.tSdpAnswerApplied),
      iceConnected: round(t.tIceConnected),
      firstTrack: round(t.tFirstTrack),
      firstFrameDecoded: round(t.tFirstFrameDecoded),
    },
  });
}

function round(v: number | undefined): number | undefined {
  return v === undefined ? undefined : Math.round(v);
}
