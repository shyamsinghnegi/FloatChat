'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Waves } from 'lucide-react';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/':        { title: 'AI Research Assistant',        subtitle: 'Ask anything about the tracked ARGO float dataset' },
  '/explore': { title: 'Mission Explorer',             subtitle: 'World map and oceanographic statistics' },
};

export default function Navbar() {
  const pathname = usePathname();

  const isProfile = pathname.startsWith('/profile/');
  const isFloat = pathname.startsWith('/float/');
  const meta = PAGE_META[pathname] ?? {
    title: isProfile ? 'Depth Profile Analysis' : isFloat ? 'Float History' : 'FloatChat',
    subtitle: isProfile ? 'Temperature and salinity vs pressure' : isFloat ? 'Dive-by-dive trends for this float' : '',
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">

      {/* ── Breadcrumb + Title ─────────────────────────── */}
      <div className="flex items-center space-x-3">
        <Link href="/" className="flex items-center space-x-1.5 text-slate-400 text-xs font-medium">
          <Waves className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          <span>FloatChat</span>
          <ChevronRight className="h-3 w-3" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">{meta.title}</h1>
          {meta.subtitle && (
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{meta.subtitle}</p>
          )}
        </div>
      </div>

      {/* ── Right side ────────────────────────────────── */}
      <div className="flex items-center space-x-3">
        <div className="hidden sm:flex flex-col items-end text-right">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Dataset</span>
          <span className="text-xs font-mono font-bold text-slate-700">33 ARGO Floats</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live</span>
        </div>
      </div>

    </header>
  );
}
