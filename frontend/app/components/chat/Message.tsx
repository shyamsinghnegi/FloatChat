'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Waves, ChevronDown, ChevronUp } from 'lucide-react';
import SqlBadge from './SqlBadge';
import type { Message as MessageType } from '@/app/lib/types';

const PREVIEW_ROWS = 5;

function formatCell(cell: unknown): string {
  if (typeof cell === 'number') {
    return Number.isInteger(cell) ? String(cell) : cell.toFixed(2);
  }
  if (typeof cell === 'string') {
    const asNum = Number(cell);
    if (cell.trim() !== '' && !Number.isNaN(asNum)) {
      return Number.isInteger(asNum) ? cell : asNum.toFixed(2);
    }
  }
  return String(cell);
}

function ResultTable({ table }: { table: NonNullable<MessageType['table']> }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = table.rows.length > PREVIEW_ROWS;
  const visibleRows = expanded || !isLong ? table.rows : table.rows.slice(0, PREVIEW_ROWS);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs divide-y" style={{ borderColor: 'var(--border)' }}>
          <thead style={{ background: '#f8f4ec' }}>
            <tr>
              {table.columns.map((col, i) => (
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
            {visibleRows.map((row, i) => (
              <tr
                key={i}
                style={{ borderBottom: i < visibleRows.length - 1 ? `1px solid var(--border)` : 'none' }}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-2.5 font-mono"
                    style={{ fontSize: '12px', color: 'var(--text-primary)' }}
                  >
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => isLong && setExpanded(e => !e)}
        className="w-full px-4 py-2 flex items-center justify-between text-left"
        style={{ borderTop: '1px solid var(--border)', background: '#f8f4ec', cursor: isLong ? 'pointer' : 'default' }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {table.rows.length} row{table.rows.length !== 1 ? 's' : ''}
          {isLong && !expanded && ` (showing first ${PREVIEW_ROWS})`}
        </span>
        {isLong && (
          expanded
            ? <ChevronUp className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
        )}
      </button>
    </div>
  );
}

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
        style={{ background: 'linear-gradient(135deg,#c1502e,#a3401f)' }}
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
        {msg.table && <ResultTable table={msg.table} />}

        {/* Profile CTA */}
        {msg.profileId && (
          <button
            onClick={() => router.push(`/dive/${msg.profileId}`)}
            className="flex items-center space-x-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            style={{ background: '#f4e4da', color: '#a3401f', border: '1px solid #e8c4ab' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#efd7c5')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f4e4da')}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>View depth profile: {msg.profileId}</span>
          </button>
        )}
      </div>
    </div>
  );
}
