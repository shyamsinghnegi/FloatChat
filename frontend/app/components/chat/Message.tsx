'use client';

import { useRouter } from 'next/navigation';
import { Activity, Waves } from 'lucide-react';
import SqlBadge from './SqlBadge';
import type { Message as MessageType } from '@/app/lib/types';

export default function Message({ msg }: { msg: MessageType }) {
  const router = useRouter();
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end py-2 fade-up">
        <div
          className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
          style={{ background: 'var(--user-bubble)', color: 'var(--text-primary)' }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  /* ── Assistant message ────────────────────────── */
  return (
    <div className="flex items-start space-x-3 py-3 fade-up">
      {/* Avatar */}
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}
      >
        <Waves className="h-3.5 w-3.5 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Text */}
        {msg.content && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
            {msg.content}
          </p>
        )}

        {/* SQL */}
        {msg.sql && <SqlBadge sql={msg.sql} />}

        {/* Table */}
        {msg.table && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs divide-y" style={{ borderColor: 'var(--border)' }}>
                <thead style={{ background: '#fafafa' }}>
                  <tr>
                    {msg.table.columns.map((col, i) => (
                      <th
                        key={i}
                        className="px-4 py-2.5 text-left font-semibold uppercase tracking-wide"
                        style={{ fontSize: '10px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {msg.table.rows.map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: i < msg.table!.rows.length - 1 ? `1px solid var(--border)` : 'none' }}
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="px-4 py-2.5 font-mono"
                          style={{ fontSize: '12px', color: 'var(--text-primary)' }}
                        >
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2" style={{ borderTop: '1px solid var(--border)', background: '#fafafa' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {msg.table.rows.length} row{msg.table.rows.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Profile CTA */}
        {msg.profileId && (
          <button
            onClick={() => router.push(`/profile/${msg.profileId}`)}
            className="flex items-center space-x-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f0f9ff')}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>View depth profile — {msg.profileId}</span>
          </button>
        )}
      </div>
    </div>
  );
}
