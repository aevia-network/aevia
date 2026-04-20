'use client';

import worldData from '@/data/world-110m.json';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { useEffect, useMemo, useState } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';

type ProviderHealth = {
  id: string;
  name: string;
  hardware: string;
  region: string;
  lat: number;
  lng: number;
  online: boolean;
  activeSessions: number;
  rttMs: number | null;
  peerId: string;
};

type ApiResponse = {
  providers: ProviderHealth[];
  summary: {
    total: number;
    online: number;
    offline: number;
    totalActiveSessions: number;
    probedAt: string;
  };
};

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 480;

// Visual tokens — match design system "Sovereign Editorial" palette.
const COLORS = {
  countryFill: 'rgba(63, 107, 92, 0.08)',
  countryStroke: 'rgba(63, 107, 92, 0.32)',
  graticule: 'rgba(63, 107, 92, 0.06)',
  online: '#3F6B5C',
  onlineHalo: 'rgba(63, 107, 92, 0.35)',
  offline: '#B83B3B',
  offlineHalo: 'rgba(184, 59, 59, 0.30)',
  arc: '#5A8F7E',
};

function getCountriesFC(): FeatureCollection<Geometry> {
  const topo = worldData as unknown as Topology<{ countries: GeometryCollection }>;
  return feature(topo, topo.objects.countries) as FeatureCollection<Geometry>;
}

export function NetworkMap({ initial }: { initial: ApiResponse }) {
  const [data, setData] = useState<ApiResponse>(initial);
  const [hovered, setHovered] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  // Poll the API every 30s for fresh provider state.
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('/api/network/providers', { cache: 'no-store' });
        if (res.ok) {
          const next = (await res.json()) as ApiResponse;
          setData(next);
        }
      } catch {
        /* ignore — keep last successful payload */
      }
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Animation tick (used to phase the arcs).
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const loop = (t: number) => {
      setNow((t - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const projection = useMemo(
    () =>
      geoEqualEarth()
        .scale(165)
        .translate([VIEWBOX_WIDTH / 2, VIEWBOX_HEIGHT / 2 + 20]),
    [],
  );
  const pathGen = useMemo(() => geoPath(projection), [projection]);
  const countries = useMemo(() => getCountriesFC(), []);

  // All distinct online provider pairs (combinatorial). Each gets a phased arc.
  const onlineProviders = data.providers.filter((p) => p.online);
  const pairs = useMemo(() => {
    const out: Array<{ from: ProviderHealth; to: ProviderHealth; offset: number }> = [];
    for (let i = 0; i < onlineProviders.length; i++) {
      const a = onlineProviders[i];
      if (!a) continue;
      for (let j = i + 1; j < onlineProviders.length; j++) {
        const b = onlineProviders[j];
        if (!b) continue;
        out.push({
          from: a,
          to: b,
          // Phase offset by index so packets don't all fire at the same instant.
          offset: ((i * 7 + j * 11) % 30) / 10,
        });
      }
    }
    return out;
  }, [onlineProviders]);

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="block w-full h-auto"
        role="img"
        aria-label="Aevia provider-node network map"
      >
        {/* Countries */}
        <g>
          {(countries.features as Feature<Geometry>[]).map((f, idx) => {
            const d = pathGen(f);
            if (!d) return null;
            return (
              <path
                key={(f.id as string | undefined) ?? `c-${idx}`}
                d={d}
                fill={COLORS.countryFill}
                stroke={COLORS.countryStroke}
                strokeWidth={0.5}
              />
            );
          })}
        </g>

        {/* Arcs — animated traffic between online provider pairs */}
        <g>
          {pairs.map((pair) => {
            const a = projection([pair.from.lng, pair.from.lat]);
            const b = projection([pair.to.lng, pair.to.lat]);
            if (!a || !b) return null;
            const [ax, ay] = a;
            const [bx, by] = b;
            // Quadratic Bezier control point above the midpoint for arc curvature.
            const mx = (ax + bx) / 2;
            const my = (ay + by) / 2;
            const dx = bx - ax;
            const dy = by - ay;
            const dist = Math.hypot(dx, dy);
            const curveAmp = Math.min(80, dist * 0.25);
            // Perpendicular offset for control point.
            const cx = mx - (dy / dist) * curveAmp;
            const cy = my - (dx / dist) * curveAmp - 15;
            const arcD = `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
            // Phase 0..1 of the moving packet along the arc.
            const phase = ((now + pair.offset) % 3) / 3;
            // Quadratic Bezier point at parameter t.
            const t = phase;
            const oneMinusT = 1 - t;
            const px = oneMinusT * oneMinusT * ax + 2 * oneMinusT * t * cx + t * t * bx;
            const py = oneMinusT * oneMinusT * ay + 2 * oneMinusT * t * cy + t * t * by;
            const fadeIn = Math.min(1, phase * 4);
            const fadeOut = Math.min(1, (1 - phase) * 4);
            const packetOpacity = Math.min(fadeIn, fadeOut) * 0.9;
            return (
              <g key={`${pair.from.id}-${pair.to.id}`}>
                <path
                  d={arcD}
                  fill="none"
                  stroke={COLORS.arc}
                  strokeWidth={0.8}
                  strokeOpacity={0.35}
                  strokeDasharray="2 4"
                />
                <circle cx={px} cy={py} r={3} fill={COLORS.online} opacity={packetOpacity} />
                <circle
                  cx={px}
                  cy={py}
                  r={6}
                  fill="none"
                  stroke={COLORS.online}
                  strokeOpacity={packetOpacity * 0.5}
                  strokeWidth={1}
                />
              </g>
            );
          })}
        </g>

        {/* Provider dots */}
        <g>
          {data.providers.map((p) => {
            const proj = projection([p.lng, p.lat]);
            if (!proj) return null;
            const [x, y] = proj;
            const fill = p.online ? COLORS.online : COLORS.offline;
            const halo = p.online ? COLORS.onlineHalo : COLORS.offlineHalo;
            const isHover = hovered === p.id;
            // Pulsing halo for online nodes.
            const pulsePhase = (Math.sin(now * 1.6 + p.lat) + 1) / 2;
            const pulseR = p.online ? 10 + pulsePhase * 6 : 9;
            const pulseOpacity = p.online ? 0.4 - pulsePhase * 0.25 : 0.4;
            return (
              <g
                key={p.id}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={x} cy={y} r={pulseR} fill={halo} opacity={pulseOpacity} />
                <circle cx={x} cy={y} r={5} fill={fill} stroke="#0F1115" strokeWidth={1.2} />
                {isHover ? (
                  <g>
                    <rect
                      x={x + 10}
                      y={y - 30}
                      width={150}
                      height={48}
                      fill="#0F1115"
                      stroke={COLORS.countryStroke}
                      strokeWidth={0.8}
                      rx={4}
                    />
                    <text
                      x={x + 18}
                      y={y - 16}
                      fill="#F3EEE4"
                      fontFamily="var(--font-mono)"
                      fontSize={10}
                      fontWeight={500}
                    >
                      {p.name} · {p.region}
                    </text>
                    <text
                      x={x + 18}
                      y={y - 2}
                      fill="rgba(243,238,228,0.65)"
                      fontFamily="var(--font-mono)"
                      fontSize={9}
                    >
                      {p.online ? 'online' : 'offline'} · {p.activeSessions} sessions
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
