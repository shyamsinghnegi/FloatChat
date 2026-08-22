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
import type { FloatMeta } from '@/app/lib/types';
import { floatLabel } from '@/app/lib/floatName';

const GEO_URL = '/world-110m.json';

function BuoyIcon({ color }: { color: string }) {
  return (
    <g transform="translate(-8,-16)">
      <circle cx="8" cy="20" r="2" fill="#00000022" />
      <path d="M8 4 L12 12 L4 12 Z" fill={color} stroke="#fff" strokeWidth="0.75" />
      <circle cx="8" cy="14" r="4" fill={color} stroke="#fff" strokeWidth="1" />
      <line x1="8" y1="18" x2="8" y2="20" stroke={color} strokeWidth="1.5" />
    </g>
  );
}

export default function WorldMap({
  floats, center = [70, 5], zoom = 2.2,
}: {
  floats: FloatMeta[];
  center?: [number, number];
  zoom?: number;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<FloatMeta | null>(null);

  return (
    <div className="relative h-[500px] w-full overflow-hidden" style={{ background: '#eef1ec' }}>
      <ComposableMap projectionConfig={{ scale: 140 }} className="h-full w-full">
        <ZoomableGroup center={center} zoom={zoom} minZoom={1} maxZoom={12}>
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

          {floats.map(f => (
            <Marker
              key={f.float_id}
              coordinates={[f.longitude, f.latitude]}
              onClick={() => router.push(`/float/${f.float_id}`)}
              onMouseEnter={() => setHovered(f)}
              onMouseLeave={() => setHovered(null)}
            >
              <g className="cursor-pointer">
                <BuoyIcon color="#c1502e" />
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
          <p className="font-bold mb-1" style={{ color: '#e08a63' }}>
            {floatLabel(hovered.number, hovered.region)}
          </p>
          <p>Lat: {hovered.latitude.toFixed(4)}</p>
          <p>Lon: {hovered.longitude.toFixed(4)}</p>
          <p className="mt-1" style={{ color: '#c9beb0' }}>Last dive: {hovered.latest_date}</p>
        </div>
      )}

      <div
        className="absolute bottom-3 right-3 backdrop-blur px-3 py-2 rounded-lg text-xs shadow"
        style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--text-secondary)' }}
      >
        {floats.length} float{floats.length !== 1 ? 's' : ''} tracked
      </div>
    </div>
  );
}
