/**
 * Canonical list of Aevia provider-nodes.
 *
 * This is the source of truth for the network map at /network. The
 * runtime status (online/offline + active_sessions) is fetched live
 * from each `/healthz` endpoint by `app/api/network/providers/route.ts`.
 *
 * Lat/lng + region are fallbacks for nodes whose `/healthz` does not
 * yet publish them (commit pending on rtx4090, rtx2080, GH200-2). Once
 * those nodes start publishing, the live response overrides these.
 */

export type ProviderRegion =
  | 'US-VA'
  | 'US-FL'
  | 'BR-PB'
  | 'BR-SP'
  | 'EU-DE'
  | 'EU-NL'
  | 'AS-SG';

export type ProviderRecord = {
  id: string;
  name: string;
  hardware: string;
  region: ProviderRegion;
  /** Latitude in degrees, -90 to 90. */
  lat: number;
  /** Longitude in degrees, -180 to 180. */
  lng: number;
  /** HTTPS endpoint exposing /healthz */
  healthzUrl: string;
  /** libp2p peer ID. */
  peerId: string;
};

export const PROVIDERS: ProviderRecord[] = [
  {
    id: 'relay-1',
    name: 'Relay 1',
    hardware: 'Lambda Labs · NVIDIA GH200 (ARM + H100)',
    region: 'US-VA',
    lat: 39.04,
    lng: -77.49,
    healthzUrl: 'https://provider.aevia.network/healthz',
    peerId: '12D3KooWSvprtPXxXHEASpKux1vLyxWpBRYTps39GQrTEpccMjyh',
  },
  {
    id: 'relay-2',
    name: 'Relay 2',
    hardware: 'ReliableSite · AMD64',
    region: 'US-FL',
    lat: 25.77,
    lng: -80.19,
    healthzUrl: 'https://provider-fl.aevia.network/healthz',
    peerId: '12D3KooWEs9TrvY9Bq59bqLAYxZ3yWJpw33CAggDJ6YpekNvQXSS',
  },
  {
    id: 'mac-br-pb',
    name: 'Mac',
    hardware: 'Apple Silicon (estação pessoal)',
    region: 'BR-PB',
    lat: -7.12,
    lng: -34.85,
    healthzUrl: 'https://provider-br.aevia.network/healthz',
    peerId: '12D3KooW9pUVkXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXMm2k',
  },
  {
    id: 'rtx4090-br-sp',
    name: 'rtx4090',
    hardware: 'Nobara · NVIDIA RTX 4090',
    region: 'BR-SP',
    lat: -23.55,
    lng: -46.63,
    healthzUrl: 'https://provider-sp.aevia.network/healthz',
    peerId: '12D3KooWQkJuSNJds2QFTBH9sq3LEHLLd4nLWAki2J5i6UUpD9hf',
  },
  {
    id: 'rtx2080-br-sp',
    name: 'rtx2080',
    hardware: 'Nobara · NVIDIA RTX 2080',
    region: 'BR-SP',
    // Slight jitter from rtx4090 so dots don't overlap visually.
    lat: -23.65,
    lng: -46.5,
    healthzUrl: 'https://provider-sp2.aevia.network/healthz',
    peerId: '12D3KooWPHNiqYokjg33w8QWFGQkhkHywBBb3M73eGquqF5Wjzw7',
  },
  {
    id: 'gh200-2-us-va',
    name: 'GH200-2',
    hardware: 'Lambda Labs · 2º Grace Hopper ARM',
    region: 'US-VA',
    // Slight jitter from Relay 1 (also US-VA).
    lat: 39.18,
    lng: -77.62,
    healthzUrl: 'https://provider-va2.aevia.network/healthz',
    peerId: '12D3KooWPDncJvmsrqE4cQcYLESzVr5nsjJAc3QRCBQkDHTmRFNA',
  },
];
