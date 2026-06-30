'use client';

import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client-fetch';

/**
 * Client for the Super Agent SSE endpoint (POST /api/agent/super).
 * Streams: session | thinking | tool_call | tool_result | confirm_required
 *          | message | done | error.
 * The backend runs on OpenAI (GPT-4.1) and persists turns in
 * dropship_copilot_sessions (mode='super').
 */

export type ChatRole = 'user' | 'assistant';

export interface ChatStep {
  kind: 'thinking' | 'tool_call' | 'tool_result' | 'confirm';
  text: string;
  isError?: boolean;
}

export interface ChatMessage {
  role: ChatRole;
  text: string;
  steps?: ChatStep[];
}

interface SuperEvent {
  type: 'session' | 'thinking' | 'tool_call' | 'tool_result' | 'confirm_required' | 'message' | 'done' | 'error';
  sessionId?: string;
  text?: string;
  message?: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  is_error?: boolean;
  tool?: string;
  reason?: string;
  confirmKey?: string;
}

function summarize(value: unknown, max = 160): string {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function useSuperAgentChat(page: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || running) return;

      setError(null);
      setRunning(true);
      setMessages((m) => [
        ...m,
        { role: 'user', text: trimmed },
        { role: 'assistant', text: '', steps: [] },
      ]);

      const pushStep = (step: ChatStep) =>
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') last.steps = [...(last.steps ?? []), step];
          return next;
        });

      const appendAssistant = (chunk: string) =>
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') last.text += chunk;
          return next;
        });

      try {
        const res = await apiFetch('/api/agent/super', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            page,
            sessionId: sessionIdRef.current,
            confirmations: {},
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // SSE frame parser — events are separated by a blank line.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const line = frame.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            let ev: SuperEvent;
            try {
              ev = JSON.parse(line.slice(5).trim()) as SuperEvent;
            } catch {
              continue;
            }
            switch (ev.type) {
              case 'session':
                if (ev.sessionId) sessionIdRef.current = ev.sessionId;
                break;
              case 'thinking':
                if (ev.text) pushStep({ kind: 'thinking', text: ev.text });
                break;
              case 'tool_call':
                pushStep({ kind: 'tool_call', text: `${ev.name}(${summarize(ev.input)})` });
                break;
              case 'tool_result':
                pushStep({
                  kind: 'tool_result',
                  text: `${ev.name} → ${summarize(ev.output)}`,
                  isError: ev.is_error,
                });
                break;
              case 'confirm_required':
                pushStep({ kind: 'confirm', text: `Confirmation requise : ${ev.tool} (${ev.reason})` });
                break;
              case 'message':
                if (ev.text) appendAssistant(ev.text);
                break;
              case 'error':
                setError(ev.message ?? 'Erreur');
                break;
              case 'done':
                break;
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur réseau');
      } finally {
        setRunning(false);
      }
    },
    [page, running],
  );

  const reset = useCallback(() => {
    sessionIdRef.current = undefined;
    setMessages([]);
    setError(null);
  }, []);

  return { messages, running, error, send, reset };
}
