'use client';

import type { MeshHandle } from '@/lib/mesh/p2p';
import { useEffect, useRef } from 'react';

/**
 * Fase 3.1 client-only boundary for the libp2p browser node.
 *
 * next-on-pages 1.13 concatenates every edge-function chunk into a
 * single Worker script. libp2p's transitive ESM graph produces
 * duplicate top-level identifiers that the concatenator isn't robust
 * enough to rename, so `next build` succeeds but the post-process
 * aborts with "A duplicated identifier has been detected".
 *
 * Loading this component via `next/dynamic({ ssr: false })` tells
 * Next to emit it into a client-only chunk that the edge compilation
 * unit never sees, sidestepping the bundler bug entirely. The libp2p
 * cost stays off the initial payload because we only mount this
 * component when `?p2p=1` is present in the URL.
 */

export interface MeshBootProps {
  sessionId: string;
  bootstraps: string[];
  heartbeatIntervalMs?: number;
  onStatus: (stats: { connected: number; topicPeers: number }) => void;
}

export default function MeshBoot(props: MeshBootProps) {
  const handleRef = useRef<MeshHandle | null>(null);

  useEffect(() => {
    if (!props.sessionId) return;
    if (props.bootstraps.length === 0) return;

    let cancelled = false;
    let statusPoll: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      try {
        const { initMesh } = await import('@/lib/mesh/p2p');
        if (cancelled) return;
        const handle = await initMesh({
          sessionId: props.sessionId,
          bootstraps: props.bootstraps,
          heartbeatIntervalMs: props.heartbeatIntervalMs ?? 5_000,
        });
        if (cancelled) {
          await handle.stop();
          return;
        }
        handleRef.current = handle;
        statusPoll = setInterval(() => {
          const s = handle.status();
          props.onStatus({ connected: s.connectedPeerCount, topicPeers: s.topicPeerCount });
        }, 2_000);
        const s0 = handle.status();
        props.onStatus({ connected: s0.connectedPeerCount, topicPeers: s0.topicPeerCount });
      } catch (err) {
        console.error('[p2p] init failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (statusPoll) clearInterval(statusPoll);
      void handleRef.current?.stop();
      handleRef.current = null;
    };
  }, [props.sessionId, props.bootstraps, props.heartbeatIntervalMs, props.onStatus]);

  return null;
}
