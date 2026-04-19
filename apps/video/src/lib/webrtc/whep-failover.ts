/**
 * WHEP failover orchestrator (Fase 2.3).
 *
 * Wraps `playWhep` with cross-provider retry logic. Given an ordered
 * list of candidate providers (peerID + httpsBase) for a single
 * sessionID, `playWhepWithFailover` tries each until one establishes
 * a media connection. When the active stream later disconnects (ICE
 * failed, remote closed, sustained silence) it automatically tears
 * down the current PC and advances to the next candidate — no page
 * reload, no fatal error, viewer feels a brief stutter at worst.
 *
 * The candidate list comes from `resolveSessionProviders`: same
 * sessionCID on the DHT, multiple peerIDs (origin + mirrors). As
 * long as at least one provider still serves the stream, viewers
 * keep watching.
 *
 * Scope boundary: this lib does NOT re-resolve the DHT mid-session.
 * If the initial candidate list is exhausted we surface `failed-all`
 * and the caller decides whether to do a fresh resolve. A smarter
 * version (Fase 2.3b) would refresh when 50% of candidates fail.
 */

import { type WhepMetrics, type WhepSession, playWhep } from './whep';

/** One candidate the failover orchestrator can attempt to play. */
export interface FailoverCandidate {
  peerId: string;
  httpsBase: string;
}

/** State transitions surfaced via onStateChange. */
export type FailoverState =
  | 'idle'
  /** Opening a POST /whep against the current candidate. */
  | 'connecting'
  /** PC reached connected. Healthy. */
  | 'connected'
  /** Active stream broke; tearing down + advancing to next candidate. */
  | 'failing-over'
  /** All candidates tried, none worked. Terminal. */
  | 'failed-all';

export interface FailoverStateContext {
  candidate: FailoverCandidate | null;
  attempt: number;
  totalAttempts: number;
}

export interface FailoverOptions {
  /** The shared WHIP sessionID — same across all candidates by DHT
   * construction. Appended to httpsBase as `/whep/{sessionId}`. */
  sessionId: string;
  /** Ordered candidate list, best-first. Typically produced by
   * resolveSessionProviders + rankProvidersByRegion + probeProvidersRTT. */
  candidates: FailoverCandidate[];
  /** Milliseconds of connection-state silence before declaring the
   * active PC broken and moving on. Default 8000. */
  silenceTimeoutMs?: number;
  /** Milliseconds per candidate to complete SDP + ICE before giving up
   * and advancing. Default 6000. */
  connectTimeoutMs?: number;
  /** Fires on every state transition + includes the active candidate
   * when known. Callers use this to drive UI ("reconectando..."). */
  onStateChange?: (state: FailoverState, ctx: FailoverStateContext) => void;
  /** Forwarded to playWhep — logs WHEP timing to console when truthy. */
  debugLog?: boolean;
  /** Forwarded to playWhep — receives per-attempt timing milestones. */
  onMetrics?: (metrics: WhepMetrics, candidate: FailoverCandidate) => void;
  /** Called with the remote MediaStream on first successful attach —
   * the caller binds it to a <video> element. Re-fires on every
   * successful failover (video element srcObject should be swapped). */
  onStream?: (stream: MediaStream, candidate: FailoverCandidate) => void;
}

export interface FailoverHandle {
  /** Stop any active session + halt the failover loop. Subsequent
   * state transitions are suppressed. Idempotent. */
  stop: () => Promise<void>;
  /** Snapshot — which candidate the current session is talking to. */
  activeCandidate: () => FailoverCandidate | null;
}

/**
 * Kicks off the failover loop. Returns a handle the caller uses to
 * stop the loop and query state. The loop runs asynchronously and
 * drives onStateChange; the returned promise resolves AFTER the
 * first attempt has been dispatched (so React effect code can
 * capture the handle quickly).
 */
export function playWhepWithFailover(opts: FailoverOptions): FailoverHandle {
  const silenceTimeoutMs = opts.silenceTimeoutMs ?? 8_000;
  const connectTimeoutMs = opts.connectTimeoutMs ?? 6_000;
  const total = opts.candidates.length;

  let stopped = false;
  let activeSession: WhepSession | null = null;
  let activeCand: FailoverCandidate | null = null;
  let attempt = 0;

  const emit = (state: FailoverState) => {
    if (stopped) return;
    opts.onStateChange?.(state, {
      candidate: activeCand,
      attempt,
      totalAttempts: total,
    });
  };

  const cleanupActive = async () => {
    if (activeSession) {
      await activeSession.stop().catch(() => undefined);
      activeSession = null;
    }
    activeCand = null;
  };

  const loop = async () => {
    if (total === 0) {
      emit('failed-all');
      return;
    }
    for (let i = 0; i < opts.candidates.length && !stopped; i++) {
      const candidate = opts.candidates[i];
      if (!candidate) continue;
      attempt = i + 1;
      activeCand = candidate;
      emit('connecting');

      const whepUrl = `${candidate.httpsBase.replace(/\/+$/, '')}/whep/${encodeURIComponent(opts.sessionId)}`;
      // Per-attempt signals drive the advance-to-next decision.
      let connected = false;
      let broken = false;
      const waitPromise = new Promise<'connected' | 'broken' | 'timeout'>((resolve) => {
        const connectTimer = setTimeout(() => {
          if (!connected) {
            broken = true;
            resolve('timeout');
          }
        }, connectTimeoutMs);
        const settled = (result: 'connected' | 'broken' | 'timeout') => {
          clearTimeout(connectTimer);
          resolve(result);
        };
        // Poll: either connection state callback flipped `connected`
        // or `broken`, check here every 50ms. Cheap; avoids a second
        // event-channel just for this.
        const poll = setInterval(() => {
          if (stopped) {
            clearInterval(poll);
            settled('broken');
            return;
          }
          if (connected) {
            clearInterval(poll);
            settled('connected');
            return;
          }
          if (broken) {
            clearInterval(poll);
            settled('broken');
            return;
          }
        }, 50);
      });

      try {
        const session = await playWhep({
          whepUrl,
          debugLog: opts.debugLog,
          onMetrics: (m) => opts.onMetrics?.(m, candidate),
          onConnectionStateChange: (state) => {
            if (stopped) return;
            if (state === 'connected' && !connected) {
              connected = true;
              emit('connected');
            }
            // `disconnected` is transient per W3C — NIC blip, ICE roam,
            // brief packet loss drop the state momentarily and it
            // transitions back to `connected` on its own. Acting on it
            // produces false failovers whenever the network coughs,
            // especially on mobile 4G paths with peer-reflexive ICE
            // candidates and no TURN relay. Same bug was fixed on the
            // WHIP publisher side in commit e31877a — keep the two
            // sides symmetric. `failed` and `closed` are terminal per
            // spec and we still tear down on those.
            if (state === 'failed' || state === 'closed') {
              broken = true;
            }
          },
        });
        activeSession = session;
        if (session.stream) {
          opts.onStream?.(session.stream, candidate);
        }

        const outcome = await waitPromise;
        if (stopped) {
          await cleanupActive();
          return;
        }
        if (outcome === 'connected') {
          // Active session is live — wait until it breaks (which flips
          // `broken` via onConnectionStateChange) or a silence timer
          // expires. Once broken, we fail over.
          await waitUntilBrokenOrSilent(
            () => broken,
            () => stopped,
            silenceTimeoutMs,
          );
          if (stopped) {
            await cleanupActive();
            return;
          }
          emit('failing-over');
          await cleanupActive();
          // Continue loop → next candidate.
          continue;
        }
        // Not connected within window — tear down and advance to next.
        await cleanupActive();
      } catch {
        // playWhep threw (HTTP error, network, etc.). Advance.
        await cleanupActive();
      }
    }
    emit('failed-all');
  };

  // Fire-and-forget the loop. Caller's handle.stop() aborts cleanly.
  void loop();

  return {
    stop: async () => {
      stopped = true;
      await cleanupActive();
    },
    activeCandidate: () => activeCand,
  };
}

/**
 * Waits for either the `isBroken` predicate to return true (stream
 * failed/closed, caller stopped, etc.) or for stop() to be called.
 * Returns once either condition hits.
 *
 * Post-connected behaviour: we rely entirely on onConnectionStateChange
 * to raise `isBroken()`. There is no wall-clock safety net here —
 * a previous version had a `silenceTimeoutMs * 4` fallback that was
 * removed after it was found to tear down perfectly healthy live
 * sessions once they ran past ~32s, producing the exact
 * "nenhum dos N provedores conseguiu servir a live" false-positive
 * we were trying to avoid. The guard we actually want is "no RTP
 * packets arrived" which requires getStats polling; that's a future
 * refinement. Until then, a truly dead connection manifests either
 * as `failed` / `closed` via onConnectionStateChange, or the caller
 * bails via stop(). Both are already handled correctly.
 */
function waitUntilBrokenOrSilent(
  isBroken: () => boolean,
  isStopped: () => boolean,
  _silenceTimeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (isStopped() || isBroken()) {
        clearInterval(check);
        resolve();
        return;
      }
    }, 500);
  });
}
