'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Message } from '../lib/types';
import { getClientId } from '../lib/clientId';

interface Session {
  id: string;
  title: string;
  date: string;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  loadingStatus: string;
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Ready for a new analysis. Ask me about ARGO data!',
};

function emptyChat(): ChatState {
  return { messages: [WELCOME], isLoading: false, loadingStatus: '' };
}

interface ChatContextType {
  chat: ChatState;
  sessions: Session[];
  currentSessionId: string | null;
  loadSession: (id: string) => Promise<void>;
  createNewSession: () => string;
  deleteSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  sendMessage: (sessionKey: string, text: string) => Promise<void>;
  pendingQuestion: string | null;
  askAbout: (text: string) => void;
  clearPendingQuestion: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  // One ChatState per session key. A brand-new, not-yet-persisted chat uses a
  // temporary client-generated key until the backend assigns a real session_id.
  const [chats, setChats] = useState<Record<string, ChatState>>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const abortControllers = useRef<Record<string, AbortController>>({});
  // Set by "Ask AI about this X" entry points, read once by ChatWindow to
  // pre-fill the input - kept in state instead of a URL param so the question
  // text never touches the address bar.
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const patchChat = (key: string, patch: Partial<ChatState>) => {
    setChats(prev => ({ ...prev, [key]: { ...(prev[key] ?? emptyChat()), ...patch } }));
  };

  const updateMessages = (key: string, updater: (msgs: Message[]) => Message[]) => {
    setChats(prev => {
      const existing = prev[key] ?? emptyChat();
      return { ...prev, [key]: { ...existing, messages: updater(existing.messages) } };
    });
  };

  const refreshSessions = async () => {
    try {
      const res = await fetch(`/api/sessions?client_id=${getClientId()}`);
      if (res.ok) setSessions(await res.json());
    } catch (e) {}
  };

  const createNewSession = (): string => {
    const tempKey = `local-${crypto.randomUUID()}`;
    setChats(prev => ({ ...prev, [tempKey]: emptyChat() }));
    setCurrentSessionId(tempKey);
    return tempKey;
  };

  const loadSession = async (id: string) => {
    setCurrentSessionId(id);
    if (chats[id]) return; // already loaded, just switch to it
    try {
      const res = await fetch(`/api/sessions/${id}?client_id=${getClientId()}`);
      if (res.ok) {
        const data = await res.json();
        const messages: Message[] = data.map((m: any, i: number) => ({ ...m, id: `msg-${i}` }));
        patchChat(id, { messages, isLoading: false, loadingStatus: '' });
      }
    } catch (e) {}
  };

  const deleteSession = async (id: string) => {
    abortControllers.current[id]?.abort();
    delete abortControllers.current[id];
    await fetch(`/api/sessions/${id}?client_id=${getClientId()}`, { method: 'DELETE' });
    setChats(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (currentSessionId === id) createNewSession();
    refreshSessions();
  };

  const sendMessage = async (sessionKey: string, text: string) => {
    const question = text.trim();
    const current = chats[sessionKey] ?? emptyChat();
    if (!question || current.isLoading) return;

    const isTemp = sessionKey.startsWith('local-');
    const backendSessionId = isTemp ? null : sessionKey;

    const history = current.messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }));

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: question };
    const asstId = (Date.now() + 1).toString();

    updateMessages(sessionKey, msgs => [...msgs.filter(m => m.id !== 'welcome'), userMsg, { id: asstId, role: 'assistant', content: '' }]);
    patchChat(sessionKey, { isLoading: true, loadingStatus: 'Connecting…' });

    const controller = new AbortController();
    abortControllers.current[sessionKey] = controller;

    // Reassigned once the backend hands back a real session_id for a
    // temp-keyed chat, so every write after the rename lands in the right slot.
    let activeKey = sessionKey;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history,
          session_id: backendSessionId,
          client_id: getClientId(),
        }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error('No body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      // A chunk can cut a line in half, so incomplete lines carry over to the next read
      // instead of being parsed (and thrown on) immediately - this used to silently drop
      // the "done" event on a chunk-boundary race, leaving the session on its temp key.
      let buffer = '';

      while (!done) {
        const { value, done: rDone } = await reader.read();
        done = rDone;
        if (value) buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = done ? '' : lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === 'status') { patchChat(activeKey, { loadingStatus: data.text }); continue; }

          if (data.type === 'session') {
            // Sent as soon as the backend creates the session row - rename the temp
            // key immediately so Recent picks it up without waiting for the reply
            // to finish streaming (a page refresh before "done" used to lose the
            // session from view entirely, even though it already existed in Postgres).
            if (data.session_id && isTemp) {
              const oldKey = activeKey;
              setChats(prev => {
                const { [oldKey]: chatState, ...rest } = prev;
                return { ...rest, [data.session_id]: chatState };
              });
              setCurrentSessionId(prevId => (prevId === oldKey ? data.session_id : prevId));
              abortControllers.current[data.session_id] = abortControllers.current[oldKey];
              delete abortControllers.current[oldKey];
              activeKey = data.session_id;
              refreshSessions();
            }
            continue;
          }

          if (data.type === 'done') {
            patchChat(activeKey, { loadingStatus: '' });
            if (data.profile_id) {
              updateMessages(activeKey, msgs => msgs.map(m => m.id === asstId ? { ...m, profileId: data.profile_id } : m));
            }
            continue;
          }

          if (data.type === 'token' && data.text) patchChat(activeKey, { loadingStatus: '' });
          updateMessages(activeKey, msgs => msgs.map(msg => {
            if (msg.id !== asstId) return msg;
            const u = { ...msg };
            if (data.type === 'token') u.content += data.text;
            if (data.type === 'sql')   u.sql = data.sql;
            if (data.type === 'table') u.table = { columns: data.columns, rows: data.rows };
            return u;
          }));
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      updateMessages(activeKey, msgs => msgs.map(m =>
        m.id === asstId
          ? { ...m, content: 'Connection error. Make sure the FastAPI backend is running on port 8000.' }
          : m
      ));
    } finally {
      patchChat(activeKey, { isLoading: false, loadingStatus: '' });
      delete abortControllers.current[activeKey];
    }
  };

  useEffect(() => {
    refreshSessions();
    createNewSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askAbout = (text: string) => setPendingQuestion(text);
  const clearPendingQuestion = () => setPendingQuestion(null);

  const chat = (currentSessionId && chats[currentSessionId]) || emptyChat();

  return (
    <ChatContext.Provider value={{
      chat, sessions, currentSessionId,
      loadSession, createNewSession, deleteSession, refreshSessions, sendMessage,
      pendingQuestion, askAbout, clearPendingQuestion,
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
