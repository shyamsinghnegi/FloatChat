'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import WorldMap from '@/app/components/viz/WorldMap';
import { fetchFloats, fetchRegions } from '@/app/lib/api';
import { floatLabel } from '@/app/lib/floatName';
import { useChat } from '@/app/context/ChatContext';
import type { FloatMeta, RegionMeta } from '@/app/lib/types';

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export default function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { askAbout } = useChat();
  const [allFloats, setAllFloats] = useState<FloatMeta[] | null>(null);
  const [regions, setRegions] = useState<RegionMeta[]>([]);

  useEffect(() => {
    Promise.all([fetchFloats(), fetchRegions()])
      .then(([f, r]) => { setAllFloats(f.floats); setRegions(r.regions); })
      .catch(() => setAllFloats([]));
  }, []);

  if (!allFloats) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  const regionFloats = allFloats.filter(f => slugify(f.region) === slug);
  const regionMeta = regions.find(r => r.slug === slug);
  const regionName = regionMeta?.name ?? regionFloats[0]?.region ?? 'Unknown Region';

  if (regionFloats.length === 0) return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: 'var(--text-secondary)' }}>No floats found for this region.</p>
    </div>
  );

  const center: [number, number] = regionMeta
    ? [regionMeta.longitude, regionMeta.latitude]
    : [regionFloats[0].longitude, regionFloats[0].latitude];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px', width: '100%' }} className="fade-up">

        {/* Back */}
        <Link
          href="/explore"
          className="inline-flex items-center space-x-1.5 text-sm mb-8 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to all regions</span>
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
              Ocean Region
            </p>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {regionName}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {regionFloats.length} float{regionFloats.length !== 1 ? 's' : ''} tracked
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
              {[...regionFloats].sort((a, b) => a.number - b.number).map(f => (
                <option key={f.float_id} value={f.float_id}>{floatLabel(f.number, f.region)}</option>
              ))}
            </select>
            <button
              onClick={() => {
                askAbout(`Tell me about the floats in the ${regionName}. What patterns or notable conditions show up across them?`);
                router.push('/chat');
              }}
              className="inline-flex items-center space-x-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Sparkles className="h-4 w-4" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>

        {/* Map */}
        <div>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Float Locations</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Click any buoy to see that float&rsquo;s dive history</p>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            <WorldMap floats={regionFloats} center={center} zoom={4.5} />
          </div>
        </div>

      </div>
    </div>
  );
}
