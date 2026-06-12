'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

export default function SqlBadge({ sql }: { sql: string }) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden text-xs" style={{ border: '1px solid var(--border)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        style={{ background: '#1e1e1e' }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center space-x-2">
          <span className="font-mono font-semibold" style={{ color: '#6ee7b7', fontSize: '11px' }}>SQL</span>
          <span style={{ color: '#6b7280', fontSize: '11px' }}>
            {open ? 'Hide query' : 'View generated query'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={e => { e.stopPropagation(); copy(); }}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-md transition-colors"
            style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)', color: copied ? '#6ee7b7' : '#9ca3af' }}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          {open
            ? <ChevronUp className="h-3.5 w-3.5" style={{ color: '#6b7280' }} />
            : <ChevronDown className="h-3.5 w-3.5" style={{ color: '#6b7280' }} />}
        </div>
      </div>

      {/* Code */}
      {open && (
        <div style={{ background: '#141414', padding: '12px 16px', overflowX: 'auto' }}>
          <pre className="font-mono leading-relaxed" style={{ color: '#e5e7eb', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
            {sql}
          </pre>
        </div>
      )}
    </div>
  );
}
