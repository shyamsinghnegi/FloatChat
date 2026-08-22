'use client';

import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';

const STORAGE_KEY = 'floatchat-demo-notice-seen';

export default function DemoNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(43,36,32,0.45)' }}
      onClick={dismiss}
    >
      <div
        className="w-full rounded-2xl p-6 fade-up"
        style={{ maxWidth: 420, background: '#fff', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Info className="h-4.5 w-4.5" />
          </div>
          <button onClick={dismiss} style={{ color: 'var(--text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          This is a demo project
        </h2>
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
          FloatChat runs on a free AI tier with a limited number of queries per day.
          If responses stop working, the daily quota has likely been reached. It resets the next day.
        </p>
        <button
          onClick={dismiss}
          className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
