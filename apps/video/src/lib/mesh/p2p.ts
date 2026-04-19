/**
 * Browser libp2p scaffold (Fase 3.1).
 *
 * First step toward P2P viewer mesh: the viewer spins up a small
 * libp2p node in the browser, dials a provider-node over WebSocket,
 * and joins a GossipSub topic scoped to the live session. Subsequent
 * fases (3.2 chunk relay, 3.3 WebRTC RTP relay) build on top of this
 * publish/subscribe fabric.
 *
 * Scope of THIS file: just enough to prove connectivity.
 *
 *  - Dials WSS bootstrap peers
 *  - Joins topic `aevia-live-{sessionId}`
 *  - Broadcasts a tiny "hello" heartbeat every 5s
 *  - Counts connected peers + peers seen in the topic
 *
 * The exported `initMesh` runs in the main thread for the MVP. Web
 * Worker isolation lands in Fase 3.1b — libp2p runs fine on the main
 * thread at this scale (one session, handful of peers).
 *
 * Bundle cost: ~300-400 KB gzipped. Callers MUST import dynamically
 * (`await import('@/lib/mesh/p2p')`) so the P2P code doesn't bloat
 * the initial page load for viewers who opt out.
 */

import { type GossipSub, gossipsub } from '@chainsafe/libp2p-gossipsub';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { identify } from '@libp2p/identify';
import { webSockets } from '@libp2p/websockets';
import { type Libp2p, createLibp2p } from 'libp2p';

export interface InitMeshOptions {
  /** WHIP sessionID — becomes the GossipSub topic suffix. Distinct
   * lives stay on distinct topics so unrelated traffic doesn't leak. */
  sessionId: string;
  /** WSS multiaddrs of provider-nodes the browser can dial.
   * Typical prod form:
   *   "/dns4/provider.aevia.network/tcp/443/wss/p2p/12D3Koo..."
   * At least one entry required. */
  bootstraps: string[];
  /** How often to publish a "hello" heartbeat on the topic. Zero
   * disables heartbeats (silent observer). Default 5000 ms. */
  heartbeatIntervalMs?: number;
}

export interface MeshStatus {
  /** Peers currently open on the libp2p connection manager. */
  connectedPeerCount: number;
  /** Peers seen at least once on the session's GossipSub topic. */
  topicPeerCount: number;
  /** Self peer ID — published once at init; stable until stop. */
  selfPeerId: string;
}

export interface MeshHandle {
  /** Latest status snapshot. Cheap — reads in-memory counters. */
  status: () => MeshStatus;
  /** Publish a raw message on the session topic. Returns the
   * recipients count from gossipsub's accounting. */
  publish: (payload: Uint8Array) => Promise<number>;
  /** Subscribe to messages on the session topic. Returns an
   * unsubscribe function. */
  onMessage: (handler: (from: string, payload: Uint8Array) => void) => () => void;
  /** Shut down the libp2p node + drop connections. Idempotent. */
  stop: () => Promise<void>;
}

/**
 * Builds a libp2p browser node and joins the session's GossipSub
 * topic. Returns a handle for publish/subscribe + lifecycle.
 */
export async function initMesh(opts: InitMeshOptions): Promise<MeshHandle> {
  if (!opts.sessionId) {
    throw new Error('initMesh: sessionId is required');
  }
  if (!opts.bootstraps || opts.bootstraps.length === 0) {
    throw new Error('initMesh: at least one bootstrap multiaddr is required');
  }

  const topic = `aevia-live-${opts.sessionId}`;
  const heartbeatInterval = opts.heartbeatIntervalMs ?? 5_000;

  // Default libp2p browser stack: WebSockets transport, Noise
  // encryption, Yamux multiplexing, identify protocol, GossipSub
  // pubsub. Bootstrap peer discovery from the supplied WSS list.
  //
  // The `as never` casts paper over a known TypeScript pain in the
  // libp2p modular ecosystem: service factory types declare stricter
  // component shapes than what libp2p's runtime registrar actually
  // satisfies, because the transitive deps pin slightly-different
  // @libp2p/interface versions. Runtime works fine; only the type
  // checker chokes. Cast scoped to the options literal only.
  const node: Libp2p = await createLibp2p({
    transports: [webSockets() as never],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    peerDiscovery: [bootstrap({ list: opts.bootstraps }) as never],
    services: {
      identify: identify() as never,
      pubsub: gossipsub({ emitSelf: false }) as never,
    },
  });

  await node.start();

  // Track topic peers we've seen at least once. GossipSub raises
  // subscription-change events as peers join/leave; we count uniques.
  //
  // The createLibp2p type returns the factory FUNCTION for each
  // service (libp2p's internals invoke them to produce the instance),
  // but at runtime `node.services.pubsub` IS the GossipSub instance.
  // Cast through unknown to paper over that typing gap — it's a
  // well-known libp2p TS quirk.
  const topicPeers = new Set<string>();
  const pubsub = node.services.pubsub as unknown as GossipSub;
  pubsub.addEventListener('subscription-change', (evt) => {
    const detail = evt.detail;
    for (const sub of detail.subscriptions) {
      if (sub.topic !== topic) continue;
      if (sub.subscribe) {
        topicPeers.add(detail.peerId.toString());
      } else {
        topicPeers.delete(detail.peerId.toString());
      }
    }
  });

  // Join the session's topic. Publishes won't fan out anywhere
  // yet — they land on any peer already subscribed, and gossipsub
  // handles propagation transparently.
  pubsub.subscribe(topic);

  const messageHandlers = new Set<(from: string, payload: Uint8Array) => void>();
  pubsub.addEventListener('message', (evt) => {
    if (evt.detail.topic !== topic) return;
    // Messages come as SignedMessage | UnsignedMessage. We default
    // gossipsub to signed, so `from` is present — guard to satisfy TS.
    const msg = evt.detail;
    const fromStr = 'from' in msg ? msg.from.toString() : '';
    for (const handler of messageHandlers) {
      handler(fromStr, msg.data);
    }
  });

  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  if (heartbeatInterval > 0) {
    const heartbeat = new TextEncoder().encode(
      JSON.stringify({ t: 'hello', peer: node.peerId.toString(), ts: Date.now() }),
    );
    heartbeatTimer = setInterval(() => {
      // publish() returns void | Promise<void> depending on impl
      // state; wrap so we can swallow rejections without
      // unhandled-promise warnings.
      void Promise.resolve(pubsub.publish(topic, heartbeat)).catch(() => {
        // Non-fatal: no peers yet or pubsub transient error.
      });
    }, heartbeatInterval);
  }

  return {
    status: (): MeshStatus => ({
      connectedPeerCount: node.getConnections().length,
      topicPeerCount: topicPeers.size,
      selfPeerId: node.peerId.toString(),
    }),
    publish: async (payload: Uint8Array) => {
      const result = await pubsub.publish(topic, payload);
      return result.recipients.length;
    },
    onMessage: (handler) => {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },
    stop: async () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = undefined;
      }
      await Promise.resolve(node.stop()).catch(() => undefined);
    },
  };
}

/** Parse `NEXT_PUBLIC_AEVIA_LIBP2P_BOOTSTRAPS` — CSV of WSS multiaddrs. */
export function parseLibp2pBootstraps(raw: string): string[] {
  return (
    raw
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}
