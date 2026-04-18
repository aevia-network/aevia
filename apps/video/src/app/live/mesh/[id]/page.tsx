import { PlayerScreen } from '@/components/player-screen';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Aevia-mesh viewer. The sessionID in the URL is the WHIP session the
 * creator started on a provider-node (not a Cloudflare uid). The viewer
 * fetches the HLS playlist directly from the mesh — no Cloudflare round
 * trip, no central registry. Stream liveness is inferred client-side
 * from playlist availability (hls.js reloads the manifest continuously
 * while the session is open).
 *
 * Creator identity and manifest CID land with Protocol Spec §3 (signed
 * manifests); for now we render anonymous metadata.
 */
export default async function MeshLiveViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meshUrl = process.env.NEXT_PUBLIC_AEVIA_MESH_URL?.trim();
  if (!meshUrl) {
    // Mesh disabled in this deployment. Treat as 404 — viewer can't
    // reach any provider-node, so there's nothing to render.
    notFound();
  }
  const base = meshUrl.replace(/\/+$/, '');

  return (
    <PlayerScreen
      uid={id}
      title="transmissão ao vivo · rede aevia"
      whepUrl={''}
      hlsUrl={null}
      aeviaHlsUrl={`${base}/live/${id}/playlist.m3u8`}
      aeviaWhepUrl={`${base}/whep/${id}`}
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
