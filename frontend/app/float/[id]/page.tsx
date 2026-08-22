'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchFloat, fetchFloats } from '@/app/lib/api';
import { floatLabel } from '@/app/lib/floatName';
import { useChat } from '@/app/context/ChatContext';
import type { FloatData, FloatMeta, FloatDive } from '@/app/lib/types';

const CATEGORIES = [
  { key: 'surface_temp' as const, label: 'Surface Temperature', unit: '°C', color: '#c1502e' },
  { key: 'avg_temp'     as const, label: 'Water Column Temperature', unit: '°C', color: '#a3401f' },
  { key: 'avg_salinity' as const, label: 'Salinity', unit: 'PSU', color: '#4d7c0f' },
  { key: 'max_depth'    as const, label: 'Max Depth', unit: 'dbar', color: '#6b5f52' },
];

type CategoryKey = typeof CATEGORIES[number]['key'];

const tooltipStyle = {
  background: '#2b2420',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
};

function MetricChart({
  dives, category, onPointClick,
}: {
  dives: FloatDive[];
  category: typeof CATEGORIES[number];
  onPointClick: (dive: FloatDive) => void;
}) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dives} margin={{ top: 5, right: 20, left: 10, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe0" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#d8cfbf" tick={{ fontSize: 10, fill: '#9c8f7e' }}
            label={{ value: 'Date', position: 'insideBottom', offset: -16, fontSize: 11, fill: '#9c8f7e' }}
          />
          <YAxis
            domain={['auto', 'auto']}
            stroke="#d8cfbf" tick={{ fontSize: 10, fill: '#9c8f7e' }}
            label={{ value: category.unit, angle: -90, position: 'insideLeft', offset: 6, fontSize: 11, fill: '#9c8f7e' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [`${Number(v).toFixed(2)} ${category.unit}`, category.label]}
          />
          <Line
            type="monotone" dataKey={category.key}
            stroke={category.color} strokeWidth={2}
            dot={{ r: 3, fill: category.color, cursor: 'pointer' }}
            activeDot={{
              r: 6, fill: category.color, stroke: '#fff', strokeWidth: 2, cursor: 'pointer',
              onClick: (_: unknown, payload: any) => onPointClick(payload.payload as FloatDive),
            }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FloatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: floatId } = use(params);
  const router = useRouter();
  const { askAbout } = useChat();
  const [data, setData] = useState<FloatData | null>(null);
  const [allFloats, setAllFloats] = useState<FloatMeta[]>([]);
  const [selected, setSelected] = useState<CategoryKey[]>(['surface_temp']);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!floatId) return;
    setData(null);
    setError('');
    fetchFloat(floatId).then(setData).catch(err => setError(err.message));
  }, [floatId]);

  useEffect(() => {
    fetchFloats().then(r => setAllFloats(r.floats)).catch(() => {});
  }, []);

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

  const { dives } = data;
  const latest = dives[dives.length - 1];
  const label = floatLabel(data.number, data.region);

  const toggleCategory = (key: CategoryKey) => {
    setSelected(prev =>
      prev.includes(key)
        ? (prev.length > 1 ? prev.filter(k => k !== key) : prev)
        : [...prev, key]
    );
  };

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
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
              ARGO Float History
            </p>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {label}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {dives.length} dives &middot; {dives[0]?.date} to {latest?.date}
              <span className="ml-2" style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '12px' }}>
                (WMO {floatId})
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {allFloats.length > 0 && (
              <select
                value={floatId}
                onChange={e => router.push(`/float/${e.target.value}`)}
                className="text-sm rounded-xl px-4 py-2.5 outline-none"
                style={{ border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)' }}
              >
                {[...allFloats].sort((a, b) => a.number - b.number).map(f => (
                  <option key={f.float_id} value={f.float_id}>{floatLabel(f.number, f.region)}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => {
                askAbout(`Tell me about ${label} (WMO ${floatId}). What patterns do you see across its dive history?`);
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

        {/* Meta row */}
        <div
          className="grid grid-cols-3 gap-4 rounded-2xl p-5 mb-8"
          style={{ background: '#f8f4ec', border: '1px solid var(--border)' }}
        >
          {[
            { label: 'Latest position', value: `${latest.latitude.toFixed(2)}°, ${latest.longitude.toFixed(2)}°` },
            { label: 'Latest cycle', value: `#${latest.cycle_number}` },
            { label: 'Last dive', value: latest.date },
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

        {/* Metric selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(c => {
            const active = selected.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCategory(c.key)}
                className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                style={{
                  background: active ? c.color : '#fff',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${active ? c.color : 'var(--border)'}`,
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Stacked charts, one per selected metric */}
        <div className="space-y-6">
          {CATEGORIES.filter(c => selected.includes(c.key)).map(c => (
            <div
              key={c.key}
              className="rounded-2xl p-6"
              style={{ border: '1px solid var(--border)', background: '#fff' }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{c.label}</h2>
              <MetricChart dives={dives} category={c} onPointClick={dive => router.push(`/dive/${dive.profile_id}`)} />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
