'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import TrajectoryMap from '@/app/components/viz/TrajectoryMap';
import { fetchStats, fetchProfiles } from '@/app/lib/api';
import type { StatData, ProfileMeta } from '@/app/lib/types';

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
      <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

export default function ExplorePage() {
  const [stats, setStats] = useState<StatData | null>(null);
  const [profiles, setProfiles] = useState<ProfileMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStats(), fetchProfiles()])
      .then(([s, p]) => { setStats(s); setProfiles(p.profiles); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  if (!stats || !profiles.length) return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: 'var(--text-secondary)' }}>Backend offline — start FastAPI on port 8000</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px', width: '100%' }} className="fade-up">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
            INCOIS · Indian Argo Project
          </p>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Float WMO 2903954
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {stats.first_dive} – {stats.latest_dive}
          </p>
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
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Float Trajectory</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Click any point to view its depth profile</p>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            <TrajectoryMap profiles={profiles} />
          </div>
        </div>

      </div>
    </div>
  );
}
