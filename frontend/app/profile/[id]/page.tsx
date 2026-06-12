'use client';

import { useState, useEffect, use } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import DepthProfile from '@/app/components/viz/DepthProfile';
import { fetchProfile } from '@/app/lib/api';
import type { ProfileData } from '@/app/lib/types';

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = use(params);
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profileId) return;
    fetchProfile(profileId).then(setData).catch(err => setError(err.message));
  }, [profileId]);

  if (error) return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: '#ef4444' }}>{error}</p>
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  const { meta, readings } = data;
  const maxDepth = readings.length ? Math.max(...readings.map(r => r.pressure)) : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px', width: '100%' }} className="fade-up">

        {/* Back */}
        <Link
          href="/explore"
          className="inline-flex items-center space-x-1.5 text-sm mb-8 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Explorer</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
            ARGO Float Profile
          </p>
          <h1 className="text-2xl font-bold font-mono mb-1" style={{ color: 'var(--text-primary)' }}>
            {meta.profile_id}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Float {meta.float_id} · Cycle {meta.cycle_number} · {meta.date}
          </p>
        </div>

        {/* Meta row */}
        <div
          className="grid grid-cols-3 gap-4 rounded-2xl p-5 mb-8"
          style={{ background: '#fafafa', border: '1px solid var(--border)' }}
        >
          {[
            { label: 'Latitude',  value: `${meta.latitude.toFixed(4)}° N` },
            { label: 'Longitude', value: `${meta.longitude.toFixed(4)}° E` },
            { label: 'Max depth', value: `${maxDepth.toFixed(0)} dbar` },
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

        {/* Charts */}
        <DepthProfile data={readings} />

      </div>
    </div>
  );
}
