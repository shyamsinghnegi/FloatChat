'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import Message from './Message';
import ChatInput from './ChatInput';
import { Waves, Database, Thermometer, Droplets, Navigation, Activity } from 'lucide-react';

/* ─── Home screen ─────────────────────────────────────────────── */
const PROMPT_CARDS = [
  {
    icon: Database,
    title: 'Database overview',
    prompt: 'How many total profiles are in the database? Show all locations and dates.',
  },
  {
    icon: Thermometer,
    title: 'Temperature analysis',
    prompt: 'What is the average surface temperature for profile 2903954_5?',
  },
  {
    icon: Droplets,
    title: 'Salinity ranking',
    prompt: 'Which profile has the highest average salinity?',
  },
  {
    icon: Activity,
    title: 'Deep water data',
    prompt: 'Show temperature readings below 500 decibars for profile 2903954_10.',
  },
  {
    icon: Navigation,
    title: 'Spatial query',
    prompt: 'Which profile was recorded at the southernmost latitude?',
  },
  {
    icon: Waves,
    title: 'Temporal query',
    prompt: 'What was the first profile recorded and when?',
  },
];

function HomeScreen({ onPrompt }: { onPrompt: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 fade-up" style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      {/* Greeting */}
      <div className="text-center mb-10">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}
        >
          <Waves className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          What can I help with?
        </h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Ask anything about ARGO float data — temperatures, salinity, profiles, locations.
        </p>
      </div>

      {/* Prompt cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
        {PROMPT_CARDS.map((card, i) => (
          <button
            key={i}
            onClick={() => onPrompt(card.prompt)}
            className="prompt-card text-left group"
          >
            <div className="flex items-start space-x-3">
              <card.icon className="h-4 w-4 mt-0.5 shrink-0 transition-colors" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{card.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{card.prompt}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Main ChatWindow ─────────────────────────────────────────── */
export default function ChatWindow() {
  const { messages, setMessages, currentSessionId, setCurrentSessionId, refreshSessions } = useChat();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0 && messages[0]?.id !== 'welcome';

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || isLoading) return;

    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: question };
    setMessages(prev => {
      const filtered = prev.filter(m => m.id !== 'welcome');
      return [...filtered, userMsg];
    });
    setInput('');
    setIsLoading(true);
    setLoadingStatus('Connecting…');

    const asstId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: asstId, role: 'assistant', content: '' }]);

    try {
      const res = await fetch('http://127.0.0.1:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history: messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content })),
          session_id: currentSessionId,
        }),
      });

      if (!res.body) throw new Error('No body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: rDone } = await reader.read();
        done = rDone;
        if (!value) continue;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === 'status') { setLoadingStatus(data.text); continue; }
          if (data.type === 'done') {
            setLoadingStatus('');
            if (data.session_id && !currentSessionId) {
              setCurrentSessionId(data.session_id);
              refreshSessions();
            }
            if (data.profile_id) {
              setMessages(prev => prev.map(m => m.id === asstId ? { ...m, profileId: data.profile_id } : m));
            }
            continue;
          }
          setMessages(prev => prev.map(msg => {
            if (msg.id !== asstId) return msg;
            const u = { ...msg };
            if (data.type === 'token') u.content += data.text;
            if (data.type === 'sql')   u.sql = data.sql;
            if (data.type === 'table') u.table = { columns: data.columns, rows: data.rows };
            return u;
          }));
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === asstId
          ? { ...m, content: 'Connection error — make sure the FastAPI backend is running on port 8000.' }
          : m
      ));
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="flex flex-col h-full">
      {!hasMessages ? (
        /* ── Home screen ── */
        <>
          <HomeScreen onPrompt={text => { setInput(text); send(text); }} />
          <div className="px-4 pb-6" style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
            <ChatInput input={input} setInput={setInput} onSubmit={handleSubmit} isLoading={isLoading} />
          </div>
        </>
      ) : (
        /* ── Chat view ── */
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto py-6">
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>
              <div className="space-y-1">
                {messages.filter(m => m.id !== 'welcome').map(msg => (
                  <Message key={msg.id} msg={msg} />
                ))}
                {isLoading && messages[messages.length - 1]?.content === '' && (
                  <div className="py-4 flex items-center space-x-3 fade-up" style={{ color: 'var(--text-muted)' }}>
                    <span className="dot" /><span className="dot" /><span className="dot" />
                    {loadingStatus && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{loadingStatus}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 pb-6" style={{ maxWidth: 720 + 48, margin: '0 auto', width: '100%' }}>
            <ChatInput input={input} setInput={setInput} onSubmit={handleSubmit} isLoading={isLoading} />
          </div>
        </>
      )}
    </div>
  );
}
