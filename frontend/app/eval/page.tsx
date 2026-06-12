'use client';

import { useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { runEvaluation } from '@/app/lib/api';

const CATEGORY_COLORS: Record<string, string> = {
  aggregate: '#dbeafe',
  specific:  '#ede9fe',
  ranking:   '#fef3c7',
  spatial:   '#d1fae5',
  temporal:  '#fee2e2',
  depth:     '#cffafe',
  text:      '#f3f4f6',
};
const CATEGORY_TEXT: Record<string, string> = {
  aggregate: '#1d4ed8',
  specific:  '#6d28d9',
  ranking:   '#92400e',
  spatial:   '#065f46',
  temporal:  '#991b1b',
  depth:     '#164e63',
  text:      '#374151',
};

export default function EvalPage() {
  const [results, setResults]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [summary, setSummary]   = useState({ total: 0, avgLatency: 0 });
  const [ran, setRan]           = useState(false);

  const handleRun = async () => {
    setLoading(true);
    setRan(false);
    try {
      const data = await runEvaluation();
      setResults(data.results);
      const lat = data.results.reduce((s: number, r: any) => s + r.latency_s, 0);
      setSummary({ total: data.total, avgLatency: Number((lat / data.total).toFixed(2)) || 0 });
      setRan(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px', width: '100%' }} className="fade-up">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
              Evaluation
            </p>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              RAG Pipeline Evaluator
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Runs <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>test_cases.json</span> against the live ChromaDB + PostgreSQL pipeline
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50 shrink-0"
            style={{ background: 'var(--text-primary)', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Running…</span></>
              : <><Play className="h-4 w-4" /><span>Run tests</span></>}
          </button>
        </div>

        {/* Summary */}
        {ran && (
          <div
            className="grid grid-cols-3 gap-4 rounded-2xl p-5 mb-8 fade-up"
            style={{ background: '#fafafa', border: '1px solid var(--border)' }}
          >
            {[
              { label: 'Tests run',    value: summary.total },
              { label: 'Avg latency',  value: `${summary.avgLatency}s` },
              { label: 'Status',       value: 'Complete' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && (
          <div className="rounded-2xl overflow-hidden fade-up" style={{ border: '1px solid var(--border)' }}>
            <table className="min-w-full divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
              <thead style={{ background: '#fafafa' }}>
                <tr>
                  {['Question', 'Category', 'Latency', 'Result'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left font-semibold uppercase tracking-wide"
                      style={{ fontSize: '10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((res, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-5 py-3.5 max-w-xs">
                      <span className="text-sm line-clamp-2" style={{ color: 'var(--text-primary)' }}>{res.question}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: CATEGORY_COLORS[res.category] ?? '#f3f4f6',
                          color: CATEGORY_TEXT[res.category] ?? '#374151',
                        }}
                      >
                        {res.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {res.latency_s}s
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <span className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{res.result}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!ran && !loading && (
          <div className="text-center py-20">
            <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>No results yet</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Click <strong style={{ color: 'var(--text-primary)' }}>Run tests</strong> to start the evaluation</p>
          </div>
        )}

      </div>
    </div>
  );
}
