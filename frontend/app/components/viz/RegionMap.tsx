'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import type { RegionMeta } from '@/app/lib/types';

const GEO_URL = '/world-110m.json';

const REGION_COLORS: Record<string, string> = {
  'Bay of Bengal': '#c1502e',
  'Arabian Sea': '#0f766e',
  'Equatorial Indian Ocean': '#a3401f',
  'Southern Indian Ocean': '#7c5c1e',
};
const FALLBACK_COLOR = '#6b5f52';

function colorFor(name: string): string {
  return REGION_COLORS[name] ?? FALLBACK_COLOR;
}

function BuoyIcon({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <g transform={`translate(-8,-16) scale(${scale})`}>
      <circle cx="8" cy="20" r="2" fill="#00000022" />
      <path d="M8 4 L12 12 L4 12 Z" fill={color} stroke="#fff" strokeWidth="0.75" />
      <circle cx="8" cy="14" r="4" fill={color} stroke="#fff" strokeWidth="1" />
      <line x1="8" y1="18" x2="8" y2="20" stroke={color} strokeWidth="1.5" />
    </g>
  );
}

export default function RegionMap({ regions }: { regions: RegionMeta[] }) {
  const router = useRouter();
  const [hovered, setHovered] = useState<RegionMeta | null>(null);

  return (
    <div className="relative h-[500px] w-full overflow-hidden" style={{ background: '#eef1ec' }}>
      <ComposableMap projectionConfig={{ scale: 140 }} className="h-full w-full">
        <ZoomableGroup center={[70, 5]} zoom={2.2} minZoom={1} maxZoom={8}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#ddd6c7"
                  stroke="#c7bda8"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: '#ddd6c7' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {regions.map(r => (
            <Marker
              key={r.slug}
              coordinates={[r.longitude, r.latitude]}
              onClick={() => router.push(`/region/${r.slug}`)}
              onMouseEnter={() => setHovered(r)}
              onMouseLeave={() => setHovered(null)}
            >
              <g className="cursor-pointer">
                <BuoyIcon color={colorFor(r.name)} scale={2.2} />
              </g>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {hovered && (
        <div
          className="absolute top-3 left-3 p-3 rounded-lg shadow-xl text-sm pointer-events-none"
          style={{ background: '#2b2420', color: '#fff' }}
        >
          <p className="font-bold mb-1" style={{ color: colorFor(hovered.name) }}>{hovered.name}</p>
          <p>{hovered.float_count} tracked float{hovered.float_count !== 1 ? 's' : ''}</p>
          <p className="mt-1" style={{ color: '#c9beb0' }}>Click to view this region</p>
        </div>
      )}

      {/* Legend */}
      <div
        className="absolute bottom-3 right-3 backdrop-blur px-3 py-2.5 rounded-lg text-xs shadow space-y-1.5"
        style={{ background: 'rgba(255,255,255,0.92)' }}
      >
        {regions.map(r => (
          <div key={r.slug} className="flex items-center space-x-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: colorFor(r.name), border: '1px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>{r.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>({r.float_count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
