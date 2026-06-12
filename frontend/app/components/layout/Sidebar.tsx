'use client';

import { useChat } from '../../context/ChatContext';
import { MessageSquare, Map, FlaskConical, SquarePen, Trash2, Waves } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sessions, currentSessionId, loadSession, deleteSession, createNewSession } = useChat();

  if (pathname === '/') return null;

  const handleNew = () => {
    createNewSession();
    if (pathname !== '/chat') router.push('/chat');
  };

  const handleSession = async (id: string) => {
    if (pathname !== '/chat') router.push('/chat');
    await loadSession(id);
  };

  const navItems = [
    { href: '/explore', label: 'Explore Data',    icon: Map },
    { href: '/eval',    label: 'Eval Suite',       icon: FlaskConical },
  ];

  return (
    <aside
      className="hidden md:flex flex-col shrink-0 h-screen overflow-hidden"
      style={{ width: 'var(--sidebar-w)', background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
    >
      {/* ── Brand + New chat ─────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center space-x-2 px-1">
          <Waves className="h-5 w-5" style={{ color: 'var(--accent)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>FloatChat</span>
        </div>
        <button
          onClick={handleNew}
          title="New chat"
          className="p-2 rounded-lg hover:bg-black/5 transition-colors"
        >
          <SquarePen className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* ── Nav links ────────────────────────────── */}
      <div className="px-2 mt-1 space-y-0.5">
        <Link
          href="/chat"
          onClick={() => pathname !== '/chat' && handleNew()}
          className="flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-colors text-sm"
          style={{
            background: pathname === '/chat' ? 'rgba(0,0,0,0.07)' : 'transparent',
            color: 'var(--text-primary)',
          }}
          onMouseEnter={e => { if (pathname !== '/chat') (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
          onMouseLeave={e => { if (pathname !== '/chat') (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <MessageSquare className="h-4 w-4 shrink-0" style={{ color: 'var(--text-secondary)' }} />
          <span className="font-medium">AI Assistant</span>
        </Link>

        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-colors text-sm"
            style={{
              background: pathname.startsWith(item.href) ? 'rgba(0,0,0,0.07)' : 'transparent',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={e => { if (!pathname.startsWith(item.href)) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={e => { if (!pathname.startsWith(item.href)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <item.icon className="h-4 w-4 shrink-0" style={{ color: 'var(--text-secondary)' }} />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Divider ──────────────────────────────── */}
      <div className="mx-3 my-3" style={{ borderTop: '1px solid var(--border)' }} />

      {/* ── History ──────────────────────────────── */}
      <div className="px-4 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Recent
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-xs px-3 py-2" style={{ color: 'var(--text-muted)' }}>No conversations yet</p>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => handleSession(s.id)}
            className="group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm"
            style={{
              background: currentSessionId === s.id ? 'rgba(0,0,0,0.07)' : 'transparent',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={e => { if (currentSessionId !== s.id) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={e => { if (currentSessionId !== s.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <span className="truncate flex-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              {s.title}
            </span>
            <button
              onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity ml-1 hover:text-red-500 shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Footer ───────────────────────────────── */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Float WMO 2903954 · Indian Ocean</p>
        <div className="flex items-center space-x-1.5 mt-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <p className="text-[11px] text-emerald-600 font-medium">Systems online</p>
        </div>
      </div>
    </aside>
  );
}
