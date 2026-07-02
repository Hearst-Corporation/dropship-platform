'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import {
  SparklesIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils/cn';
import { useSuperAgentChat, type ChatMessage, type ChatStep } from './useSuperAgentChat';

/**
 * SuperAgentRail — fixed right rail (desktop, docks at xl so lg laptops keep a
 * usable content width) + slide-over drawer (below xl). The global admin
 * assistant. Streams from POST /api/agent/super (OpenAI). Chat state lives
 * here, shared by both surfaces, so closing the drawer never loses the
 * conversation. Dark theme, indigo accent — matches the admin chrome.
 */
const RAIL_WIDTH = 'xl:w-96';

function StepLine({ step }: { step: ChatStep }) {
  const icon =
    step.kind === 'thinking' ? null : step.kind === 'confirm' ? (
      <SparklesIcon className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
    ) : (
      <WrenchScrewdriverIcon className="size-3.5 shrink-0 text-indigo-400" aria-hidden />
    );
  return (
    <div
      className={cn(
        'flex items-start gap-1.5 rounded-md px-2 py-1 text-xs',
        step.isError ? 'bg-white/10 text-zinc-300' : 'bg-white/5 text-zinc-400',
      )}
    >
      {icon}
      <span className="wrap-break-word font-mono leading-relaxed">{step.text}</span>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-500 px-3 py-2 text-sm text-white">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {msg.steps && msg.steps.length > 0 && (
        <div className="space-y-1">
          {msg.steps.map((s, i) => (
            <StepLine key={i} step={s} />
          ))}
        </div>
      )}
      {msg.text && (
        <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm text-zinc-100 ring-1 ring-white/10">
          {msg.text}
        </div>
      )}
    </div>
  );
}

/** Three pulsing dots shown while the agent has produced no output yet. */
function TypingIndicator() {
  return (
    <div className="flex">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-zinc-500"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

interface ChatBodyProps {
  messages: ChatMessage[];
  running: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  reset: () => void;
  draft: string;
  setDraft: (value: string) => void;
  /** Renders a close button in the header (drawer surface only). */
  onClose?: () => void;
}

function ChatBody({ messages, running, error, send, reset, draft, setDraft, onClose }: ChatBodyProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  // Stick to the bottom only when the user is already there; smooth-scroll
  // only when a new message appears, not on every streamed token (stacked
  // smooth animations judder and hijack the scroll while reading history).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    const isNewMessage = messages.length !== lastCountRef.current;
    lastCountRef.current = messages.length;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: isNewMessage ? 'smooth' : 'auto' });
    }
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft;
    setDraft('');
    void send(text);
  };

  const lastMessage = messages[messages.length - 1];
  const waitingFirstOutput =
    running &&
    (!lastMessage ||
      lastMessage.role === 'user' ||
      (!lastMessage.text && (!lastMessage.steps || lastMessage.steps.length === 0)));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
            <SparklesIcon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Super Agent</p>
            <p className="text-xs text-zinc-500">Assistant admin · OpenAI</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          title="Nouvelle conversation"
          className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
        >
          <ArrowPathIcon className="size-4" aria-hidden />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !running ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ChatBubbleLeftRightIcon className="size-8 text-zinc-600" aria-hidden />
            <p className="mt-3 text-sm font-medium text-zinc-300">Demande à l&apos;agent</p>
            <p className="mt-1 max-w-64 text-xs text-zinc-500">
              Gère tes stores, lance des recherches, interroge la base. Il agit sur l&apos;admin.
            </p>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} msg={m} />)
        )}
        {waitingFirstOutput && <TypingIndicator />}
        {error && (
          <div className="rounded-md bg-white/10 px-3 py-2 text-xs text-zinc-300 ring-1 ring-white/15">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2 rounded-xl bg-white/5 p-2 ring-1 ring-white/10 focus-within:ring-indigo-500">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            rows={1}
            placeholder="Message à l'agent…"
            className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={running || draft.trim().length === 0}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? (
              <ArrowPathIcon className="size-4 animate-spin" aria-hidden />
            ) : (
              <PaperAirplaneIcon className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export function SuperAgentRail() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  // Chat state is owned here so the docked rail and the drawer share one
  // conversation: the Headless Dialog unmounts its children on close, and a
  // ChatBody-local hook would lose the whole session every time.
  const { messages, running, error, send, reset } = useSuperAgentChat(pathname ?? '');
  const [draft, setDraft] = useState('');

  const chatProps = { messages, running, error, send, reset, draft, setDraft };

  return (
    <>
      {/* Desktop — fixed right rail, docked from xl only (at lg the content
          area would drop to ~300px with the sidebar + rail both open) */}
      <aside
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-40 lg:flex lg:flex-col',
          'border-l border-white/10 bg-zinc-900',
          RAIL_WIDTH,
        )}
      >
        <ChatBody {...chatProps} />
      </aside>

      {/* Below xl — floating trigger + slide-over drawer */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex size-12 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-400 xl:hidden"
        aria-label="Ouvrir l'assistant"
      >
        <SparklesIcon className="size-5" aria-hidden />
      </button>

      <Dialog open={mobileOpen} onClose={setMobileOpen} className="relative z-50 xl:hidden">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-zinc-950/80 transition-opacity duration-300 data-closed:opacity-0"
        />
        <div className="fixed inset-0 flex justify-end">
          <DialogPanel
            transition
            className="relative flex w-full max-w-md transform flex-col bg-zinc-900 ring-1 ring-white/10 transition duration-300 ease-in-out data-closed:translate-x-full"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label="Fermer"
            >
              <XMarkIcon className="size-5" aria-hidden />
            </button>
            <ChatBody />
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
