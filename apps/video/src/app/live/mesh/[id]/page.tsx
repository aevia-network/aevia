import { PlayerScreen } from '@/components/player-screen';
import { type ProviderMeta, rankProvidersByRegion } from '@/lib/mesh/rank';
import { parseProviderRegistry, parseRelayList, resolveSessionProviders } from '@/lib/mesh/resolve';
import type { FailoverCandidate } from '@/lib/webrtc/whep-failover';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Aevia-mesh viewer. The sessionID in the URL is the WHIP session the
 * creator started on a provider-node (not a Cloudflare uid).
 *
 * Fase 2.3 viewer failover: before render we resolve the sessionCID via
 * the DHT, producing a list of candidate providers (origin + mirrors).
 * PlayerScreen plays from the top-ranked candidate and walks down the
 * list when the active stream breaks — no page reload, no fatal error
 * on a single provider outage.
 *
 * Without DHT envs configured the page falls back cleanly to the legacy
 * single-URL path (NEXT_PUBLIC_AEVIA_MESH_URL), preserving current
 * deployments.
 */
export default async function MeshLiveViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const fallbackBase = process.env.NEXT_PUBLIC_AEVIA_MESH_URL?.trim();
  if (!fallbackBase) {
    notFound();
  }
  const base = fallbackBase.replace(/\/+$/, '');

  // Fase 2.3 — resolve candidate providers via DHT. Both envs must be
  // set; otherwise failover is disabled and we fall back to the
  // single-URL path (aeviaWhepUrl below).
  const relays = parseRelayList(process.env.NEXT_PUBLIC_AEVIA_DHT_RELAYS ?? '');
  const registry = parseProviderRegistry(process.env.NEXT_PUBLIC_AEVIA_PROVIDER_REGISTRY ?? '');

  let failoverCandidates: FailoverCandidate[] = [];
  if (relays.length > 0 && Object.keys(registry).length > 0) {
    try {
      const resolved = await resolveSessionProviders(id, {
        relayUrls: relays,
        peerRegistry: registry,
        fallbackHttpsBase: base,
        timeoutMs: 2_500,
      });
      // No viewer geo on the server. rank-by-region with empty hint
      // produces a deterministic order based on original DHT listing;
      // the client-side failover loop walks it top-down. Viewer geo
      // hint (GeoIP, client coordinates) lands in Fase 2.3b.
      const metas: ProviderMeta[] = resolved.map((p) => ({
        peerId: p.peerId,
        httpsBase: p.httpsBase,
      }));
      const ranked = rankProvidersByRegion(metas, {});
      failoverCandidates = ranked.map((p) => ({
        peerId: p.peerId,
        httpsBase: p.httpsBase,
      }));
    } catch {
      // Resolve failure = empty candidates = legacy single-URL path
      // takes over. No error surfaced to the viewer — same UX as
      // pre-2.3 deployments.
    }
  }

  return (
    <PlayerScreen
      uid={id}
      title="transmissão ao vivo · rede aevia"
      whepUrl={''}
      hlsUrl={null}
      aeviaHlsUrl={`${base}/live/${id}/hls/index.m3u8`}
      aeviaWhepUrl={`${base}/whep/${id}`}
      aeviaSessionId={id}
      aeviaFailoverCandidates={failoverCandidates}
      aeviaLibp2pBootstraps={parseLibp2pBootstrapsInline(
        process.env.NEXT_PUBLIC_AEVIA_LIBP2P_BOOTSTRAPS ?? '',
      )}
      vodProcessing={false}
      creatorDisplayName="aevia"
      creatorAddress={null}
      state="connected"
      startedISO={new Date().toISOString()}
      manifestCid={null}
      registerBlock={null}
      registerTxHash={null}
    />
  );
}

// Inlined to avoid pulling p2p.ts (which imports libp2p — ~400 KB
// bundle) into the server/edge worker. Same shape as
// parseLibp2pBootstraps in lib/mesh/p2p.ts. Keep in sync.
function parseLibp2pBootstrapsInline(raw: string): string[] {
  return (
    raw
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}
