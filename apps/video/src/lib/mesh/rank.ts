/**
 * Aevia mesh — geo-aware provider ranking.
 *
 * Viewers with a region hint (e.g. "BR-SP" from CDN geo) and/or
 * approximate lat/lng rank the providers returned by
 * resolveSessionProvider so the closest-by-region or closest-by-
 * distance candidate wins.
 *
 * Ordering rules, in priority:
 *   1. exact region match (viewerRegion === provider.region)
 *   2. region-prefix match (viewerRegion.split("-")[0] matches
 *      provider.region.split("-")[0]; ex: "BR-SP" vs "BR-RJ")
 *   3. great-circle distance (both sides have lat/lng)
 *   4. original order from DHT resolve
 *
 * Providers without region are ranked after any region match but
 * before non-matching regions — they may still be reachable, just
 * unknown geography.
 */

export interface ProviderMeta {
  peerId: string;
  httpsBase: string;
  region?: string;
  lat?: number;
  lng?: number;
}

export interface ViewerGeo {
  region?: string;
  lat?: number;
  lng?: number;
}

/**
 * Return a new array with providers ranked from best to worst match
 * for the viewer. Stable for tied candidates — order from input
 * preserved within a tier.
 */
export function rankProvidersByRegion(
  providers: ProviderMeta[],
  viewer: ViewerGeo,
): ProviderMeta[] {
  if (providers.length <= 1) return providers.slice();

  const viewerTop = topLevelRegion(viewer.region);
  const scored = providers.map((p, originalIdx) => ({
    provider: p,
    score: scoreMatch(p, viewer, viewerTop),
    distance: haversineKm(viewer, p),
    originalIdx,
  }));

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score; // higher first
    if (a.distance !== b.distance) return a.distance - b.distance; // closer first
    return a.originalIdx - b.originalIdx; // stable fallback
  });
  return scored.map((s) => s.provider);
}

// scoreMatch returns a higher number for a "better" match.
//   3 — exact region string match
//   2 — top-level region prefix match (BR-* matches BR-*)
//   1 — provider has region + viewer has region but no prefix match
//   0 — provider has no region OR viewer has no region
function scoreMatch(p: ProviderMeta, v: ViewerGeo, viewerTop: string | null): number {
  if (!p.region || !v.region) return 0;
  if (p.region === v.region) return 3;
  const providerTop = topLevelRegion(p.region);
  if (viewerTop !== null && providerTop === viewerTop) return 2;
  return 1;
}

function topLevelRegion(region?: string): string | null {
  if (!region) return null;
  const i = region.indexOf('-');
  return i === -1 ? region : region.slice(0, i);
}

// haversineKm returns great-circle distance in kilometres. Returns
// Infinity when either side lacks complete coordinates, so the
// scored-sort falls back to original order for unknown geography.
function haversineKm(v: ViewerGeo, p: ProviderMeta): number {
  if (
    typeof v.lat !== 'number' ||
    typeof v.lng !== 'number' ||
    typeof p.lat !== 'number' ||
    typeof p.lng !== 'number'
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(p.lat - v.lat);
  const dLng = toRad(p.lng - v.lng);
  const lat1 = toRad(v.lat);
  const lat2 = toRad(p.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
