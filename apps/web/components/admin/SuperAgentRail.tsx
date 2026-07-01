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
 * SuperAgentRail — fixed right rail (desktop) + slide-over drawer (mobile).
 * The global admin assistant. Streams from POST /api/agent/super (OpenAI).
 * Dark theme, indigo accent — matches the admin chrome.
 */
const RAIL_WIDTH = 'lg:w-96';

function StepLine({ step }: { step: ChatStep }) {
  const icon =
    step.kind === 'thinking' ? null : step.kind === 'confirm' ? (
      <SparklesIcon className="size-3.5 shrink-0 text-amber-400" aria-hidden />
    ) : (
      <WrenchScrewdriverIcon className="size-3.5 shrink-0 text-indigo-400" aria-hidden />
    );
  return (
    <div
      className={cn(
        'flex items-start gap-1.5 rounded-md px-2 py-1 text-xs',
        step.isError ? 'bg-rose-500/10 text-rose-300' : 'bg-white/5 text-zinc-400',
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

function ChatBody() {
  const pathname = usePathname();
  const { messages, running, error, send, reset } = useSuperAgentChat(pathname ?? '');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft;
    setDraft('');
    void send(text);
  };

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
        {messages.length === 0 ? (
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
        {error && (
          <div className="rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/20">
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

  return (
    <>
      {/* Desktop — fixed right rail */}
      <aside
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-40 lg:flex lg:flex-col',
          'border-l border-white/10 bg-zinc-900',
          RAIL_WIDTH,
        )}
      >
        <ChatBody />
      </aside>

      {/* Mobile — floating trigger + slide-over drawer */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex size-12 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-400 lg:hidden"
        aria-label="Ouvrir l'assistant"
      >
        <SparklesIcon className="size-5" aria-hidden />
      </button>

      <Dialog open={mobileOpen} onClose={setMobileOpen} className="relative z-50 lg:hidden">
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
