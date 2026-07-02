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
      <SparklesIcon className="size-3.5 shrink-0 text-zinc-500 dark:text-zinc-600" aria-hidden />
    ) : (
      <WrenchScrewdriverIcon className="size-3.5 shrink-0 text-indigo-500" aria-hidden />
    );
  return (
    <div
      className={cn(
        'flex items-start gap-2 px-2 py-1.5 text-xs',
        step.isError ? 'text-zinc-300' : 'text-zinc-500',
      )}
    >
      {icon}
      <span className="wrap-break-word font-mono leading-relaxed uppercase tracking-wider">{step.text}</span>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-none bg-indigo-600 px-4 py-3 text-sm text-white">
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
        <div className="max-w-[90%] whitespace-pre-wrap rounded-none bg-zinc-900 px-4 py-3 text-sm text-zinc-100 border border-zinc-800">
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
      <div className="flex items-center gap-2 rounded-none bg-zinc-900 px-4 py-4 border border-zinc-800">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-none bg-zinc-500 animate-pulse"
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
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex size-3 shrink-0 items-center justify-center bg-indigo-600">
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white">Super Agent</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Assistant admin · OpenAI</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          title="Nouvelle conversation"
          className="rounded-none p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white transition-colors"
        >
          <ArrowPathIcon className="size-4" aria-hidden />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !running ? (
          <div className="flex h-full flex-col items-start justify-center">
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Demande à l&apos;agent</p>
            <p className="mt-2 text-sm text-zinc-400">
              Gère tes stores, lance des recherches, interroge la base. Il agit sur l&apos;admin.
            </p>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} msg={m} />)
        )}
        {waitingFirstOutput && <TypingIndicator />}
        {error && (
          <div className="rounded-none bg-zinc-900 px-4 py-3 text-xs text-zinc-300 border border-zinc-800">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="border-t border-zinc-800 p-4">
        <div className="flex items-end gap-2 bg-zinc-900 p-2 border border-zinc-800 focus-within:border-indigo-600 transition-colors">
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
            placeholder="MESSAGE À L'AGENT…"
            className="max-h-32 min-h-6 flex-1 resize-none bg-transparent px-2 text-[10px] font-bold uppercase tracking-widest text-white placeholder:text-zinc-600 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={running || draft.trim().length === 0}
            className="flex size-8 shrink-0 items-center justify-center bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 rounded-none"
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
          'border-l border-zinc-800 bg-zinc-950',
          RAIL_WIDTH,
        )}
      >
        <ChatBody {...chatProps} />
      </aside>

      {/* Below xl — floating trigger + slide-over drawer */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex size-12 items-center justify-center rounded-none bg-indigo-500 text-white shadow-none hover:bg-indigo-400 xl:hidden"
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
            className="relative flex w-full max-w-md transform flex-col bg-zinc-950 ring-1 ring-white/10 transition duration-300 ease-in-out data-closed:translate-x-full"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label="Fermer"
            >
              <XMarkIcon className="size-5" aria-hidden />
            </button>
            <ChatBody {...chatProps} />
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
