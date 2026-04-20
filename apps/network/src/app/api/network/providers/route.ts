import { PROVIDERS, type ProviderRecord } from '@/data/providers';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
// Refresh server-side every 30 seconds; client polls this endpoint.
export const revalidate = 30;

export type ProviderHealth = ProviderRecord & {
  online: boolean;
  activeSessions: number;
  /** When the live response carried lat/lng, those override the static fallback. */
  liveOverride: boolean;
  /** Round-trip time of the /healthz fetch in ms (server-side measurement). */
  rttMs: number | null;
  /** ISO timestamp of the probe. */
  probedAt: string;
};

type HealthzPayload = {
  status?: string;
  peer_id?: string;
  region?: string;
  lat?: number;
  lng?: number;
  active_sessions?: number;
};

async function probe(provider: ProviderRecord): Promise<ProviderHealth> {
  const startedAt = Date.now();
  const probedAt = new Date().toISOString();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(provider.healthzUrl, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    clearTimeout(timeoutId);
    const rttMs = Date.now() - startedAt;
    if (!res.ok) {
      return {
        ...provider,
        online: false,
        activeSessions: 0,
        liveOverride: false,
        rttMs,
        probedAt,
      };
    }
    const body = (await res.json()) as HealthzPayload;
    const liveLat = typeof body.lat === 'number' ? body.lat : null;
    const liveLng = typeof body.lng === 'number' ? body.lng : null;
    return {
      ...provider,
      lat: liveLat ?? provider.lat,
      lng: liveLng ?? provider.lng,
      liveOverride: liveLat !== null && liveLng !== null,
      online: body.status === 'ok',
      activeSessions: typeof body.active_sessions === 'number' ? body.active_sessions : 0,
      rttMs,
      probedAt,
    };
  } catch {
    return {
      ...provider,
      online: false,
      activeSessions: 0,
      liveOverride: false,
      rttMs: null,
      probedAt,
    };
  }
}

export async function GET() {
  const probes = await Promise.all(PROVIDERS.map(probe));
  const onlineCount = probes.filter((p) => p.online).length;
  const totalActiveSessions = probes.reduce((sum, p) => sum + p.activeSessions, 0);

  return NextResponse.json(
    {
      providers: probes,
      summary: {
        total: probes.length,
        online: onlineCount,
        offline: probes.length - onlineCount,
        totalActiveSessions,
        probedAt: new Date().toISOString(),
      },
    },
    {
      headers: {
        // Cache 30s on edge + allow stale-while-revalidate for snappy UX.
        'cache-control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    },
  );
}
