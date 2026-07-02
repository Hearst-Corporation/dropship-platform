/**
 * Module-scoped Super Agent chat state. Survives Next.js navigations and
 * SuperAgentRail remounts — only `resetSuperAgentChat()` clears the session.
 */

export type ChatRole = "user" | "assistant";

export interface ChatStep {
  kind: "thinking" | "tool_call" | "tool_result" | "confirm";
  text: string;
  isError?: boolean;
}

export interface ChatMessage {
  role: ChatRole;
  text: string;
  steps?: ChatStep[];
}

export interface SuperAgentChatSnapshot {
  messages: ChatMessage[];
  running: boolean;
  error: string | null;
  draft: string;
  sessionId: string | undefined;
}

type Listener = () => void;

let snapshot: SuperAgentChatSnapshot = {
  messages: [],
  running: false,
  error: null,
  draft: "",
  sessionId: undefined,
};

let inFlight = false;
let currentPage = "";

const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getSuperAgentChatSnapshot(): SuperAgentChatSnapshot {
  return snapshot;
}

export function subscribeSuperAgentChat(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSuperAgentPage(page: string) {
  currentPage = page;
}

export function getSuperAgentPage(): string {
  return currentPage;
}

export function isSuperAgentInFlight(): boolean {
  return inFlight;
}

export function setSuperAgentInFlight(value: boolean) {
  inFlight = value;
}

export function patchSuperAgentChat(
  partial: Partial<SuperAgentChatSnapshot>,
): void {
  snapshot = { ...snapshot, ...partial };
  emit();
}

export function updateSuperAgentMessages(
  updater: (messages: ChatMessage[]) => ChatMessage[],
): void {
  snapshot = { ...snapshot, messages: updater(snapshot.messages) };
  emit();
}

export function resetSuperAgentChat(): void {
  inFlight = false;
  snapshot = {
    messages: [],
    running: false,
    error: null,
    draft: "",
    sessionId: undefined,
  };
  emit();
}
