"use client";

import { useCallback, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/client-fetch";
import {
  getSuperAgentChatSnapshot,
  getSuperAgentPage,
  isSuperAgentInFlight,
  patchSuperAgentChat,
  resetSuperAgentChat,
  setSuperAgentInFlight,
  subscribeSuperAgentChat,
  updateSuperAgentMessages,
  type ChatMessage,
  type ChatStep,
} from "./super-agent-chat-store";

export type { ChatMessage, ChatStep } from "./super-agent-chat-store";
export type { ChatRole } from "./super-agent-chat-store";
export { setSuperAgentPage } from "./super-agent-chat-store";

/**
 * Client for the Super Agent SSE endpoint (POST /api/agent/super).
 * State lives in `super-agent-chat-store` so navigation never wipes the thread.
 */

interface SuperEvent {
  type:
    | "session"
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "confirm_required"
    | "message"
    | "done"
    | "error";
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
  if (value == null) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function useSuperAgentChat() {
  const { messages, running, error, draft, sessionId } = useSyncExternalStore(
    subscribeSuperAgentChat,
    getSuperAgentChatSnapshot,
    getSuperAgentChatSnapshot,
  );

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSuperAgentInFlight()) return;

    setSuperAgentInFlight(true);
    patchSuperAgentChat({ error: null, running: true });
    updateSuperAgentMessages((m) => [
      ...m,
      { role: "user", text: trimmed },
      { role: "assistant", text: "", steps: [] },
    ]);

    const pushStep = (step: ChatStep) =>
      updateSuperAgentMessages((m) => {
        const next = m.map((msg) => ({
          ...msg,
          steps: msg.steps ? [...msg.steps] : undefined,
        }));
        const last = next[next.length - 1];
        if (last?.role === "assistant")
          last.steps = [...(last.steps ?? []), step];
        return next;
      });

    const appendAssistant = (chunk: string) =>
      updateSuperAgentMessages((m) => {
        const next = m.map((msg) => ({ ...msg }));
        const last = next[next.length - 1];
        if (last?.role === "assistant") last.text += chunk;
        return next;
      });

    try {
      const res = await apiFetch("/api/agent/super", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          page: getSuperAgentPage(),
          sessionId,
          confirmations: {},
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let ev: SuperEvent;
          try {
            ev = JSON.parse(line.slice(5).trim()) as SuperEvent;
          } catch {
            continue;
          }
          switch (ev.type) {
            case "session":
              if (ev.sessionId) {
                patchSuperAgentChat({ sessionId: ev.sessionId });
              }
              break;
            case "thinking":
              if (ev.text) pushStep({ kind: "thinking", text: ev.text });
              break;
            case "tool_call":
              pushStep({
                kind: "tool_call",
                text: `${ev.name}(${summarize(ev.input)})`,
              });
              break;
            case "tool_result":
              pushStep({
                kind: "tool_result",
                text: `${ev.name} → ${summarize(ev.output)}`,
                isError: ev.is_error,
              });
              break;
            case "confirm_required":
              pushStep({
                kind: "confirm",
                text: `Confirmation requise : ${ev.tool} (${ev.reason})`,
              });
              break;
            case "message":
              if (ev.text) appendAssistant(ev.text);
              break;
            case "error":
              patchSuperAgentChat({ error: ev.message ?? "Erreur" });
              break;
            case "done":
              break;
          }
        }
      }
    } catch (e) {
      patchSuperAgentChat({
        error: e instanceof Error ? e.message : "Erreur réseau",
      });
    } finally {
      setSuperAgentInFlight(false);
      patchSuperAgentChat({ running: false });
    }
  }, [sessionId]);

  const reset = useCallback(() => {
    resetSuperAgentChat();
  }, []);

  const setDraft = useCallback((value: string) => {
    patchSuperAgentChat({ draft: value });
  }, []);

  return { messages, running, error, draft, send, reset, setDraft };
};
