'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Message } from '../lib/types';

interface Session {
  id: string;
  title: string;
  date: string;
}

interface ChatContextType {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sessions: Session[];
  currentSessionId: string | null;
  // 🌟 ADDED: Ability to set the current session ID manually
  setCurrentSessionId: (id: string | null) => void; 
  loadSession: (id: string) => Promise<void>;
  createNewSession: () => void;
  deleteSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const refreshSessions = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/sessions');
      if (res.ok) setSessions(await res.json());
    } catch (e) {}
  };

  const createNewSession = () => {
    setCurrentSessionId(null);
    setMessages([{ 
      id: 'welcome', 
      role: 'assistant', 
      content: 'Ready for a new analysis. Ask me about ARGO data!' 
    }]);
  };

  const loadSession = async (id: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: any, i: number) => ({ ...m, id: `msg-${i}` })));
        setCurrentSessionId(id);
      }
    } catch (e) {}
  };

  const deleteSession = async (id: string) => {
    await fetch(`http://127.0.0.1:8000/sessions/${id}`, { method: 'DELETE' });
    if (currentSessionId === id) createNewSession();
    refreshSessions();
  };

  useEffect(() => { refreshSessions(); createNewSession(); }, []);

  return (
    <ChatContext.Provider value={{ 
      messages, setMessages, sessions, currentSessionId, setCurrentSessionId,
      loadSession, createNewSession, deleteSession, refreshSessions 
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}