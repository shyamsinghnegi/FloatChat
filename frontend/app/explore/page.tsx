'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import RegionMap from '@/app/components/viz/RegionMap';
import { fetchStats, fetchFloats, fetchRegions } from '@/app/lib/api';
import { floatLabel } from '@/app/lib/floatName';
import type { StatData, FloatMeta, RegionMeta } from '@/app/lib/types';

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
      <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

export default function ExplorePage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatData | null>(null);
  const [floats, setFloats] = useState<FloatMeta[]>([]);
  const [regions, setRegions] = useState<RegionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStats(), fetchFloats(), fetchRegions()])
      .then(([s, f, r]) => { setStats(s); setFloats(f.floats); setRegions(r.regions); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  if (!stats || !floats.length) return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: 'var(--text-secondary)' }}>Backend offline. Start FastAPI on port 8000</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px', width: '100%' }} className="fade-up">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
              INCOIS Indian Argo Project
            </p>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {floats.length} Tracked Floats
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {stats.first_dive} to {stats.latest_dive}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              defaultValue=""
              onChange={e => e.target.value && router.push(`/float/${e.target.value}`)}
              className="text-sm rounded-xl px-4 py-2.5 outline-none"
              style={{ border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)' }}
            >
              <option value="" disabled>Jump to a float&hellip;</option>
              {[...floats].sort((a, b) => a.number - b.number).map(f => (
                <option key={f.float_id} value={f.float_id}>{floatLabel(f.number, f.region)}</option>
              ))}
            </select>
            <Link
              href={`/chat?q=${encodeURIComponent('Give me an overview of the ARGO floats tracked in this dataset. What regions are they in and what stands out?')}`}
              className="inline-flex items-center space-x-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Sparkles className="h-4 w-4" />
              <span>Ask AI</span>
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10">
          <StatItem label="Total dives"    value={stats.total_profiles} />
          <StatItem label="Min temp"       value={`${Number(stats.min_temp).toFixed(2)}°C`} />
          <StatItem label="Max temp"       value={`${Number(stats.max_temp).toFixed(2)}°C`} />
          <StatItem label="Avg temp"       value={`${Number(stats.avg_temp).toFixed(2)}°C`} />
        </div>

        {/* Map */}
        <div>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Ocean Regions</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Click a region to see its individual floats</p>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            <RegionMap regions={regions} />
          </div>
        </div>

      </div>
    </div>
  );
}
