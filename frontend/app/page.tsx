'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, ArrowRight, Waves, Database, Thermometer, Droplets, Activity, Navigation, Search, Brain, Lock, Map } from 'lucide-react';

const STATS = [
  { value: '42',    label: 'Dive profiles' },
  { value: '~2000', label: 'Decibars max depth' },
  { value: '3',     label: 'Data dimensions' },
  { value: '100%',  label: 'Local — no cloud' },
];

const STEPS = [
  {
    step: 'Step 1',
    title: 'Ask in plain English',
    desc: 'Type any ocean science question and FloatChat understands it without any SQL knowledge.',
    detail: '"Show temperature profiles below 500 dbar for profile 2903954_10"',
  },
  {
    step: 'Step 2',
    title: 'RAG retrieves context',
    desc: 'ChromaDB searches its vector index for the most relevant ARGO profiles and feeds context to the LLM.',
    detail: 'Semantic similarity across 42 embedded profile summaries',
  },
  {
    step: 'Step 3',
    title: 'SQL → Results → Visuals',
    desc: 'The LLM generates precise SQL, queries PostgreSQL, and returns tables, charts, and depth profiles.',
    detail: 'Temperature and salinity plotted on a depth-vs-pressure chart',
  },
];

const FEATURES = [
  { icon: Database,    title: 'Natural language queries',  desc: 'Ask anything — "Show salinity near the equator in March" — and get real SQL, real results.' },
  { icon: Thermometer, title: 'Depth profile charts',      desc: 'Visualise temperature and salinity vs pressure for any dive profile with a single click.' },
  { icon: Map,         title: 'Float trajectory map',      desc: "Track the float's path across the Indian Ocean and jump to any profile from the map." },
  { icon: Search,      title: 'RAG-powered accuracy',      desc: 'ChromaDB vector search retrieves relevant profiles; the LLM generates precise SQL.' },
  { icon: Brain,       title: 'Session memory',            desc: 'Follow-up questions work. The AI remembers the last 4 turns of your conversation.' },
  { icon: Lock,        title: 'Fully local LLM',           desc: 'Runs on Ollama + llama3.2. Your data never leaves the machine.' },
];

const LIMITATIONS = [
  'FloatChat is constrained to data from a single ARGO float — WMO 2903954. Questions about other floats or ocean regions outside this dataset will return no results.',
  'Query accuracy depends on RAG retrieval quality. Highly specific or ambiguous questions may occasionally produce incorrect SQL. Rephrasing the question usually resolves this.',
  'The local LLM (llama3.2 via Ollama) can be slower than cloud models and may struggle with very complex multi-join queries. A self-correction retry loop handles most failures automatically.',
  'Session memory is limited to the last 4 conversation turns to keep prompts within the model\'s context window. Long conversations may lose early context.',
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100%', background: '#fff', color: '#0d0d0d', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}
    >

      {/* ── Top nav ─────────────────────────────────────────────── */}
      <nav
        className="flex items-center justify-between px-8 py-4 sticky top-0 z-50"
        style={{ borderBottom: '1px solid #e5e5e5', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-center space-x-2">
          <Waves className="h-5 w-5" style={{ color: '#0ea5e9' }} />
          <span className="font-semibold text-base tracking-tight">FloatChat</span>
        </div>

        <div className="hidden md:flex items-center space-x-8">
          {[
            { label: 'How it works', href: '#how'      },
            { label: 'Features',     href: '#features' },
            { label: 'Mission',      href: '#mission'  },
            { label: 'Explore Data', href: '/explore'  },
            { label: 'Evaluator',    href: '/eval'     },
          ].map(l => (
            <Link
              key={l.label}
              href={l.href}
              className="text-sm transition-colors"
              style={{ color: '#6b7280' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0d0d0d')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <button
          onClick={() => router.push('/chat')}
          className="flex items-center space-x-1.5 text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
          style={{ background: '#0d0d0d', color: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#374151')}
          onMouseLeave={e => (e.currentTarget.style.background = '#0d0d0d')}
        >
          <span>Try FloatChat</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section
        className="flex flex-col items-center justify-center text-center px-6 py-24"
        style={{ minHeight: 'calc(100vh - 61px)', background: '#fafafa' }}
      >
        <div
          className="inline-flex items-center space-x-2 text-sm font-medium px-4 py-1.5 rounded-full mb-8"
          style={{ border: '1px solid #e5e5e5', color: '#6b7280', background: '#fff' }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#0ea5e9', boxShadow: '0 0 6px #38bdf8' }} />
          <span>SIH 25040 · Ministry of Earth Sciences / INCOIS</span>
        </div>

        <h1
          className="font-bold leading-none tracking-tighter mb-6"
          style={{ fontSize: 'clamp(42px, 8vw, 88px)', letterSpacing: '-0.04em' }}
        >
          Introducing
          <br />
          <span style={{ color: '#0ea5e9' }}>FloatChat</span>
        </h1>

        <p
          className="max-w-xl leading-relaxed mb-10"
          style={{ fontSize: 'clamp(16px,2.2vw,20px)', color: '#6b7280', lineHeight: 1.65 }}
        >
          An AI-powered conversational interface for ARGO ocean float data.
          Ask questions in plain language — get temperature profiles, salinity
          charts, and spatial analysis instantly.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center space-x-2 text-base font-semibold px-7 py-3.5 rounded-full transition-all"
            style={{ background: '#0d0d0d', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#374151')}
            onMouseLeave={e => (e.currentTarget.style.background = '#0d0d0d')}
          >
            <span>Try FloatChat</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => router.push('/explore')}
            className="flex items-center space-x-2 text-base font-medium transition-colors"
            style={{ color: '#6b7280' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0d0d0d')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          >
            <span>View mission data</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ── Stats row ───────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid #e5e5e5', borderBottom: '1px solid #e5e5e5' }}>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ maxWidth: 960, margin: '0 auto' }}>
          {STATS.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center py-10 px-4 text-center"
              style={{ borderRight: i < STATS.length - 1 ? '1px solid #e5e5e5' : 'none' }}
            >
              <span
                className="font-bold mb-1"
                style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-0.03em', color: '#0ea5e9' }}
              >
                {s.value}
              </span>
              <span className="text-sm" style={{ color: '#9ca3af' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section id="how" className="px-8 py-24" style={{ background: '#0d0d0d' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <p className="text-center text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            The pipeline
          </p>
          <h2 className="text-center font-bold mb-16" style={{ fontSize: 'clamp(26px,4vw,40px)', letterSpacing: '-0.02em', color: '#fff' }}>
            From question to insight
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl p-7 flex flex-col justify-between"
                style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', minHeight: 280 }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {s.step}
                  </p>
                  <h3 className="font-bold text-lg mb-3 leading-snug" style={{ color: '#fff' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.desc}</p>
                </div>
                <div
                  className="mt-6 rounded-xl px-4 py-3 text-xs font-mono"
                  style={{ background: 'rgba(14,165,233,0.1)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.2)' }}
                >
                  {s.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section id="features" className="px-8 py-24" style={{ background: '#fff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p className="text-center text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#9ca3af' }}>
            What it does
          </p>
          <h2 className="text-center font-bold mb-14" style={{ fontSize: 'clamp(26px,4vw,40px)', letterSpacing: '-0.02em' }}>
            Ocean data, in plain English
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 transition-all"
                style={{ background: '#fafafa', border: '1px solid #e5e5e5' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#0ea5e9';
                  (e.currentTarget as HTMLElement).style.background = '#f0f9ff';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5';
                  (e.currentTarget as HTMLElement).style.background = '#fafafa';
                }}
              >
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: '#e0f2fe' }}
                >
                  <f.icon className="h-4 w-4" style={{ color: '#0ea5e9' }} />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Limitations ─────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid #e5e5e5', background: '#fafafa' }} className="px-8 py-24">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 className="font-bold mb-10" style={{ fontSize: 'clamp(26px,4vw,40px)', letterSpacing: '-0.02em' }}>
            Limitations
          </h2>
          <ul className="space-y-7">
            {LIMITATIONS.map((l, i) => (
              <li key={i} className="flex items-start space-x-4">
                <span className="mt-2.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#0ea5e9' }} />
                <p className="text-base leading-relaxed" style={{ color: '#374151', lineHeight: 1.8 }}>{l}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Mission / Dataset ────────────────────────────────────── */}
      <section id="mission" style={{ borderTop: '1px solid #e5e5e5' }} className="px-8 py-24">
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#9ca3af' }}>
            The dataset
          </p>
          <h2 className="font-bold mb-5" style={{ fontSize: 'clamp(22px,3.5vw,36px)', letterSpacing: '-0.02em' }}>
            Indian Ocean · Float WMO 2903954
          </h2>
          <p className="leading-relaxed mb-10" style={{ color: '#6b7280', lineHeight: 1.75 }}>
            42 dive profiles from the INCOIS Indian Argo Project. Each profile
            contains pressure, temperature, and salinity readings from the surface
            down to nearly 2,000 decibars — making it one of the most detailed
            single-float datasets in the Indian Ocean.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/chat')}
              className="flex items-center space-x-2 text-sm font-semibold px-6 py-3 rounded-full transition-all"
              style={{ background: '#0ea5e9', color: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0284c7')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0ea5e9')}
            >
              <span>Open AI Assistant</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => router.push('/explore')}
              className="flex items-center space-x-2 text-sm font-medium transition-colors"
              style={{ color: '#6b7280' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0d0d0d')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
            >
              <span>Explore trajectory map</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #e5e5e5', background: '#fafafa' }} className="px-8 pt-16 pb-10">
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>

          {/* Columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#9ca3af' }}>Navigate</p>
              {[
                { label: 'AI Assistant', href: '/chat' },
                { label: 'Explore Data', href: '/explore' },
                { label: 'Evaluator',    href: '/eval' },
              ].map(l => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="block text-sm mb-3 transition-colors"
                  style={{ color: '#6b7280' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#0d0d0d')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#9ca3af' }}>Dataset</p>
              {['INCOIS ARGO Project', 'Float WMO 2903954', 'Indian Ocean', '42 Profiles'].map(t => (
                <p key={t} className="text-sm mb-3" style={{ color: '#6b7280' }}>{t}</p>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#9ca3af' }}>Stack</p>
              {['Next.js + FastAPI', 'Ollama + llama3.2', 'PostgreSQL', 'ChromaDB'].map(t => (
                <p key={t} className="text-sm mb-3" style={{ color: '#6b7280' }}>{t}</p>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#9ca3af' }}>Project</p>
              {['SIH 25040', 'Ministry of Earth Sciences', 'INCOIS'].map(t => (
                <p key={t} className="text-sm mb-3" style={{ color: '#6b7280' }}>{t}</p>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between pt-8" style={{ borderTop: '1px solid #e5e5e5' }}>
            <div className="flex items-center space-x-2">
              <Waves className="h-4 w-4" style={{ color: '#0ea5e9' }} />
              <span className="text-sm font-semibold">FloatChat</span>
            </div>
            <span className="text-xs" style={{ color: '#9ca3af' }}>
              Ministry of Earth Sciences · INCOIS · Indian Ocean
            </span>
          </div>

        </div>
      </footer>

    </div>
  );
}
