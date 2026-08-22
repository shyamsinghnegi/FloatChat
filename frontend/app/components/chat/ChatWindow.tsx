'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import Message from './Message';
import ChatInput from './ChatInput';
import DemoNotice from './DemoNotice';
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
          style={{ background: 'linear-gradient(135deg,#c1502e,#a3401f)' }}
        >
          <Waves className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          What can I help with?
        </h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Ask anything about ARGO float data: temperatures, salinity, profiles, locations.
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
  const { chat, currentSessionId, createNewSession, sendMessage, pendingQuestion, clearPendingQuestion } = useChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, loadingStatus } = chat;
  const hasMessages = messages.length > 0 && messages[0]?.id !== 'welcome';

  useEffect(() => {
    if (pendingQuestion) {
      setInput(pendingQuestion);
      clearPendingQuestion();
    }
  }, [pendingQuestion, clearPendingQuestion]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const key = currentSessionId ?? createNewSession();
    setInput('');
    sendMessage(key, text);
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="flex flex-col h-full">
      <DemoNotice />
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
                {isLoading && loadingStatus && (
                  <div className="py-3 flex items-center space-x-2.5 fade-up">
                    <span className="thinking-pulse h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{loadingStatus}</span>
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
