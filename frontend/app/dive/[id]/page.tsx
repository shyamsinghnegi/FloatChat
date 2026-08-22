'use client';

import { useState, useEffect, use } from 'react';
import { Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import DepthProfile from '@/app/components/viz/DepthProfile';
import { fetchProfile } from '@/app/lib/api';
import type { ProfileData } from '@/app/lib/types';

export default function DivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = use(params);
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profileId) return;
    fetchProfile(profileId).then(setData).catch(err => setError(err.message));
  }, [profileId]);

  if (error) return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: '#c1502e' }}>{error}</p>
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  const { meta, readings } = data;
  const maxDepth = readings.length ? Math.max(...readings.map(r => r.pressure)) : 0;
  const surfaceReadings = readings.filter(r => r.pressure < 10);
  const surfaceTemp = surfaceReadings.length
    ? surfaceReadings.reduce((sum, r) => sum + r.temperature, 0) / surfaceReadings.length
    : null;
  const avgTemp = readings.length
    ? readings.reduce((sum, r) => sum + r.temperature, 0) / readings.length
    : null;
  const avgSalinity = readings.length
    ? readings.reduce((sum, r) => sum + r.salinity, 0) / readings.length
    : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px', width: '100%' }} className="fade-up">

        {/* Back */}
        <Link
          href={`/float/${meta.float_id}`}
          className="inline-flex items-center space-x-1.5 text-sm mb-8 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Float {meta.float_id}</span>
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
              ARGO Dive Record
            </p>
            <h1 className="text-2xl font-bold font-mono mb-1" style={{ color: 'var(--text-primary)' }}>
              {meta.profile_id}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Float {meta.float_id} &middot; Cycle {meta.cycle_number} &middot; {meta.date}
            </p>
          </div>

          <Link
            href={`/chat?q=${encodeURIComponent(`Tell me about dive ${meta.profile_id} from float ${meta.float_id}. What do the temperature and salinity readings show?`)}`}
            className="inline-flex items-center space-x-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Sparkles className="h-4 w-4" />
            <span>Ask AI about this dive</span>
          </Link>
        </div>

        {/* Summary row */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-2xl p-5 mb-8"
          style={{ background: '#f8f4ec', border: '1px solid var(--border)' }}
        >
          {[
            { label: 'Latitude',      value: `${meta.latitude.toFixed(4)}°` },
            { label: 'Longitude',     value: `${meta.longitude.toFixed(4)}°` },
            { label: 'Max depth',     value: `${maxDepth.toFixed(0)} dbar` },
            { label: 'Surface temp',  value: surfaceTemp != null ? `${surfaceTemp.toFixed(2)} °C` : 'n/a' },
            { label: 'Avg temp',      value: avgTemp != null ? `${avgTemp.toFixed(2)} °C` : 'n/a' },
            { label: 'Avg salinity',  value: avgSalinity != null ? `${avgSalinity.toFixed(2)} PSU` : 'n/a' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                {item.label}
              </p>
              <p className="text-base font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Depth-vs-pressure charts */}
        <DepthProfile data={readings} />

      </div>
    </div>
  );
}
