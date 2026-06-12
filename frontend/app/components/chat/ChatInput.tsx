'use client';

import { useState } from 'react';
import { ArrowUp, Loader2, Sparkles, X } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

const EXAMPLE_PROMPTS = [
  'How many total profiles are in the database?',
  'What is the average surface temperature for profile 2903954_5?',
  'Which profile has the highest average salinity?',
  'Show data for dive cycles 10 to 20',
  'Which profile was recorded furthest south?',
  'What was the first profile recorded and when?',
  'Average temperature at 500 decibars across all profiles',
  'Show temperature readings below 1000 decibars for 2903954_3',
];

export default function ChatInput({ input, setInput, onSubmit, isLoading }: ChatInputProps) {
  const [showPrompts, setShowPrompts] = useState(false);

  const pick = (p: string) => {
    setInput(p);
    setShowPrompts(false);
  };

  return (
    <div className="relative">
      {/* ── Prompts panel ────────────────────────────────── */}
      {showPrompts && (
        <div
          className="absolute bottom-full mb-2 left-0 right-0 rounded-2xl overflow-hidden fade-up"
          style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.10)' }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Example prompts
            </span>
            <button onClick={() => setShowPrompts(false)} style={{ color: 'var(--text-muted)' }}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-2">
            {EXAMPLE_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => pick(p)}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f4')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input box ────────────────────────────────────── */}
      <form onSubmit={onSubmit}>
        <div
          className="flex items-end rounded-2xl transition-all"
          style={{
            background: '#f4f4f4',
            border: '1px solid transparent',
          }}
          onFocusCapture={e => {
            (e.currentTarget as HTMLElement).style.background = '#fff';
            (e.currentTarget as HTMLElement).style.border = '1px solid var(--border)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)';
          }}
          onBlurCapture={e => {
            (e.currentTarget as HTMLElement).style.background = '#f4f4f4';
            (e.currentTarget as HTMLElement).style.border = '1px solid transparent';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          {/* Prompts toggle */}
          <button
            type="button"
            onClick={() => setShowPrompts(s => !s)}
            title="Example prompts"
            className="self-end mb-2.5 ml-3 p-1.5 rounded-lg transition-colors shrink-0"
            style={{
              color: showPrompts ? 'var(--accent)' : 'var(--text-muted)',
              background: showPrompts ? '#f0f9ff' : 'transparent',
            }}
          >
            <Sparkles className="h-4 w-4" />
          </button>

          {/* Textarea */}
          <textarea
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask about ocean data…"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none px-3 py-3.5 text-sm leading-relaxed"
            style={{ color: 'var(--text-primary)', maxHeight: '180px', overflowY: 'auto' }}
          />

          {/* Send button */}
          <div className="self-end mb-2.5 mr-2.5 shrink-0">
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-8 w-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: input.trim() && !isLoading ? '#0ea5e9' : '#e5e5e5',
                color: input.trim() && !isLoading ? '#fff' : '#9ca3af',
              }}
            >
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <p className="text-center mt-2" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          FloatChat · Ollama llama3.2 · Indian Ocean · Float 2903954
        </p>
      </form>
    </div>
  );
}
