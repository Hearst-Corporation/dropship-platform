'use client';

import { apiFetch } from '@/lib/client-fetch';

/**
 * CopilotHub — client side of the per-store Copilote hub.
 *
 * Layout:
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  Mode pills [Recherche] [Curation] [Ads] [Médias] [Dev]       │
 *   │  Session ▾   [+ Nouvelle]                Auto-push (Dev) □    │
 *   ├────────────────────────────────────┬──────────────────────────┤
 *   │  Chat feed (60%)                   │  Contextual sidebar (40%) │
 *   │  - assistant + user + tool cards   │  - mode-specific          │
 *   │  - SSE typing dots                 │  - products / assets /    │
 *   │  - Cmd+Enter to send               │    git log / hints        │
 *   │  - confirm-push modal              │                           │
 *   └────────────────────────────────────┴──────────────────────────┘
 *
 * State:
 *   - mode: CopilotMode (persisted to localStorage per store)
 *   - sessionId: string | null (per mode)
 *   - sessions: SessionSummary[] grouped by mode in render
 *   - autoPush: boolean (only meaningful for Dev)
 *
 * SSE protocol (matches `runCopilotTurn` in lib/agent/copilot-router.ts):
 *   - session         : { sessionId, mode }
 *   - thinking        : { text }
 *   - tool_call       : { id, name, input }
 *   - tool_result     : { id, name, output, summary, is_error }
 *   - confirm_required: { tool, input, output }     dev mode push gate
 *   - message         : { text }
 *   - done            : { text }
 *   - error           : { message }
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  ShoppingBag,
  Megaphone,
  Palette,
  Code2,
  Check,
  Pause,
  Rocket,
  Folder,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, CheckboxField } from '@/components/ui/checkbox';
import { Dialog, DialogActions, DialogBody, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/fieldset';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  adminBgInset,
  adminBgPanel,
  adminBorder,
  adminBorderSoft,
  adminPanel,
  adminText,
  adminTextMuted,
} from '@/components/admin/admin-surface';
import { cn } from '@/lib/utils/cn';

export type CopilotMode = 'research' | 'curation' | 'ads' | 'medias' | 'dev';

type Role = 'user' | 'assistant' | 'tool';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  is_error?: boolean;
  streaming?: boolean;
}

interface SessionSummary {
  id: string;
  mode: CopilotMode;
  title: string | null;
  created_at: string;
  updated_at: string;
  preview: string | null;
  preview_role: 'user' | 'assistant' | null;
  message_count: number;
}

/** Minimal product shape the sidebar needs for the curation-mode thumbnails. */
export interface ProductSummary {
  id: string;
  enriched_title: string;
  price_cents: number;
  image_url: string | null;
}

export interface CopilotHubProps {
  storeId: string;
  storeSlug: string;
  storeName: string;
  /** Server-fetched products for the curation sidebar. Optional — defaults to empty. */
  initialProducts?: ProductSummary[];
}

const MODE_LABELS: Record<CopilotMode, { Icon: LucideIcon; label: string; tagline: string }> = {
  research: { Icon: Target, label: 'Recherche', tagline: 'Trouver une niche' },
  curation: { Icon: ShoppingBag, label: 'Curation', tagline: 'Catalogue produits' },
  ads: { Icon: Megaphone, label: 'Ads', tagline: 'Hooks et ciblages' },
  medias: { Icon: Palette, label: 'Médias', tagline: 'Hero, lifestyle, promo' },
  dev: { Icon: Code2, label: 'Dev', tagline: 'Code de la plateforme' },
};

const MODE_ORDER: CopilotMode[] = ['research', 'curation', 'ads', 'medias', 'dev'];

function fmtEur(cents: number) {
  return (cents / 100).toFixed(2) + ' €';
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function CopilotHub({
  storeId,
  storeSlug,
  storeName,
  initialProducts = [],
}: CopilotHubProps) {
  const [mode, setMode] = useState<CopilotMode>('research');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPush, setAutoPush] = useState(false);
  const [confirmModal, setConfirmModal] = useState<null | { tool: string; input: unknown }>(null);
  const [pendingPushMessage, setPendingPushMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // ── Persist active mode per-store
  useEffect(() => {
    const key = `copilot-mode:${storeId}`;
    try {
      const saved = localStorage.getItem(key) as CopilotMode | null;
      if (saved && MODE_ORDER.includes(saved)) setMode(saved);
    } catch { /* ignore */ }
  }, [storeId]); // storeId is stable (from props), setMode is stable (useState setter)
  useEffect(() => {
    try { localStorage.setItem(`copilot-mode:${storeId}`, mode); } catch { /* ignore */ }
  }, [mode, storeId]);

  // ── Sessions filtered by mode
  const modeSessions = useMemo(
    () => sessions.filter((s) => s.mode === mode),
    [sessions, mode],
  );

  // ── Auto-scroll
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/copilot/sessions`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { sessions: SessionSummary[] };
        setSessions(data.sessions);
      }
    } catch { /* non-fatal */ }
  }, [storeId]);

  const loadSession = useCallback(async (id: string | null) => {
    setError(null);
    setSessionId(id);
    if (!id) {
      setMessages([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/copilot/sessions/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement session');
    }
  }, [storeId]);

  // ── Initial session list load (client-fetched: this component owns its own data)
  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  // When mode changes, pick the most recent session for that mode if any.
  useEffect(() => {
    if (modeSessions.length === 0) {
      setSessionId(null);
      setMessages([]);
      return;
    }
    const current = modeSessions.find((s) => s.id === sessionId);
    if (!current) {
      const first = modeSessions[0]!;
      void loadSession(first.id);
    }
  }, [mode, modeSessions, sessionId, loadSession]);

  const startNewSession = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/copilot/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { id: string };
      setSessionId(data.id);
      setMessages([]);
      await refreshSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création session');
    }
  }, [mode, refreshSessions, storeId]);

  const sendMessage = useCallback(async (text: string, retryWithPush = false) => {
    if (!text.trim() || streaming) return;
    setError(null);
    setStreaming(true);

    const tempUserId = `temp-u-${Date.now()}`;
    const tempAsstId = `temp-a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        role: 'user',
        content: text,
        tool_name: null,
        tool_input: null,
        tool_output: null,
      },
      {
        id: tempAsstId,
        role: 'assistant',
        content: '',
        tool_name: null,
        tool_input: null,
        tool_output: null,
        streaming: true,
      },
    ]);

    let currentSessionId = sessionId;
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId ?? undefined,
          mode,
          message: text,
          autoPushConfirmed: autoPush || retryWithPush,
        }),
      });
      if (!res.ok || !res.body) {
        const errBody = await res.text();
        throw new Error(errBody || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n\n');
        buf = lines.pop() ?? '';
        for (const block of lines) {
          const data = block.replace(/^data: /, '').trim();
          if (!data) continue;
          let parsed: { type: string; data: unknown };
          try { parsed = JSON.parse(data) as { type: string; data: unknown }; }
          catch { continue; }

          if (parsed.type === 'session') {
            const sid = (parsed.data as { sessionId: string }).sessionId;
            currentSessionId = sid;
            setSessionId(sid);
          } else if (parsed.type === 'thinking' || parsed.type === 'message') {
            const t = (parsed.data as { text: string }).text || '';
            setMessages((prev) => prev.map((m) =>
              m.id === tempAsstId
                ? { ...m, content: t, streaming: parsed.type === 'thinking' }
                : m,
            ));
          } else if (parsed.type === 'tool_call') {
            const d = parsed.data as { id: string; name: string; input: unknown };
            setMessages((prev) => [
              ...prev,
              {
                id: `tc-${d.id}`,
                role: 'tool',
                content: `Appel: ${d.name}`,
                tool_name: d.name,
                tool_input: d.input,
                tool_output: null,
              },
            ]);
          } else if (parsed.type === 'tool_result') {
            const d = parsed.data as {
              id: string; name: string; output: unknown; summary: string; is_error: boolean;
            };
            setMessages((prev) => prev.map((m) =>
              m.id === `tc-${d.id}`
                ? { ...m, content: d.summary, tool_output: d.output, is_error: d.is_error }
                : m,
            ));
          } else if (parsed.type === 'confirm_required') {
            const d = parsed.data as { tool: string; input: unknown };
            if (!autoPush) {
              setConfirmModal({ tool: d.tool, input: d.input });
              setPendingPushMessage(text);
            }
          } else if (parsed.type === 'done') {
            setMessages((prev) => prev.map((m) =>
              m.id === tempAsstId ? { ...m, streaming: false } : m,
            ));
          } else if (parsed.type === 'error') {
            const m = (parsed.data as { message: string }).message;
            setError(m);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur SSE');
    } finally {
      setStreaming(false);
      await refreshSessions();
    }
  }, [autoPush, mode, refreshSessions, sessionId, storeId, streaming]);

  const onSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    void sendMessage(text);
  }, [input, sendMessage]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  }, [onSubmit]);

  const confirmPush = useCallback(async () => {
    setConfirmModal(null);
    if (pendingPushMessage) {
      // Re-send the same message with autoPushConfirmed=true. The agent
      // will replay the loop; in practice it will skip straight to git_push
      // because the prior turn already prepared the commit.
      const msg = `${pendingPushMessage}\n\n(L'utilisateur confirme: oui push.)`;
      setPendingPushMessage(null);
      await sendMessage(msg, true);
    }
  }, [pendingPushMessage, sendMessage]);

  const cancelPush = useCallback(() => {
    setConfirmModal(null);
    setPendingPushMessage(null);
  }, []);

  // ── Layout ───────────────────────────────────────────────────────────

  return (
    <>
      {/* Mode pills */}
      <div className={cn("rounded-xl border p-3", adminBorder, adminBgPanel)}>
        <div className={cn("flex flex-wrap items-center gap-1 rounded-lg p-1", adminBgInset)}>
          {MODE_ORDER.map((m) => {
            const meta = MODE_LABELS[m];
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-indigo-500 text-white" : cn(adminTextMuted, "hover:text-zinc-100"),
                )}
              >
                <meta.Icon size={16} strokeWidth={1.75} aria-hidden />
                <span className="font-medium">{meta.label}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Select
              value={sessionId ?? ''}
              onChange={(e) => loadSession(e.target.value || null)}
              className="!w-auto max-w-[260px] text-sm"
            >
              {modeSessions.length === 0 && <option value="">Aucune session</option>}
              {modeSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || fmtDate(s.updated_at)} · {s.message_count} msg
                </option>
              ))}
            </Select>
            <Button outline onClick={startNewSession}>
              + Nouvelle
            </Button>
            {mode === 'dev' && (
              <CheckboxField className="ml-2">
                <Checkbox checked={autoPush} onChange={setAutoPush} />
                <Label>Auto-push</Label>
              </CheckboxField>
            )}
          </div>
        </div>
        <p className={cn("mt-2 text-xs", adminTextMuted)}>
          {MODE_LABELS[mode].tagline}
          {mode === 'dev' && (
            <span className="ml-2 font-medium text-indigo-500">
              Mode développeur — agent avec accès lecture/écriture sur le repo.
            </span>
          )}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 flex-1 min-h-0">
        {/* CHAT */}
        <section className={cn("rounded-xl border flex flex-col min-h-[520px] lg:min-h-0 lg:h-full overflow-hidden", adminBorder, adminBgPanel)}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {messages.length === 0 && !streaming && (
              <div className={cn("text-center text-sm mt-12", adminTextMuted)}>
                <p className={cn("font-medium flex items-center justify-center gap-2", adminText)}>
                  {(() => {
                    const ModeIcon = MODE_LABELS[mode].Icon;
                    return <ModeIcon size={16} strokeWidth={1.75} aria-hidden />;
                  })()}
                  {MODE_LABELS[mode].label}
                </p>
                <p className="mt-1">{getModeHint(mode, storeName)}</p>
              </div>
            )}

            {messages.map((m) => {
              if (m.role === 'user') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className={cn("max-w-[78%] rounded-2xl rounded-tr-md px-4 py-2.5 text-sm whitespace-pre-wrap", adminBgInset, adminText)}>
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (m.role === 'assistant') {
                return (
                  <div key={m.id} className="flex justify-start">
                    <div className={cn("max-w-[78%] rounded-2xl rounded-tl-md border px-4 py-2.5 text-sm whitespace-pre-wrap", adminBorder, adminBgPanel, adminText)}>
                      {m.content || (m.streaming ? <TypingDots /> : <span className={adminTextMuted}>…</span>)}
                    </div>
                  </div>
                );
              }
              return <ToolCard key={m.id} message={m} />;
            })}
          </div>

          {error && (
            <div className={cn("px-5 py-2 text-xs border-t", adminBgInset, adminBorder, adminTextMuted)}>
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className={cn("p-3 border-t", adminBorder, adminBgPanel)}>
            <div className="flex gap-2 items-end">
              <Textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={`Demande quelque chose à ${MODE_LABELS[mode].label}… (Cmd+Enter pour envoyer)`}
                rows={2}
                disabled={streaming}
                resizable={false}
                className="flex-1 !text-sm"
              />
              <Button type="submit" color="indigo" disabled={streaming || !input.trim()} className="shrink-0">
                {streaming ? 'Envoi…' : 'Envoyer'}
              </Button>
            </div>
          </form>
        </section>

        {/* SIDEBAR */}
        <aside className={cn("rounded-xl border flex flex-col min-h-[520px] lg:min-h-0 lg:h-full overflow-hidden", adminBorder, adminBgPanel)}>
          <header className={cn("px-5 py-3 border-b", adminBorder)}>
            <div className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>
              Contexte
            </div>
            <p className={cn("mt-0.5 text-sm font-medium", adminText)}>
              {MODE_LABELS[mode].label}
            </p>
          </header>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <Sidebar mode={mode} storeSlug={storeSlug} products={initialProducts} />
          </div>
        </aside>
      </div>

      {/* Confirm push modal */}
      <Dialog open={confirmModal !== null} onClose={cancelPush} size="md">
        <div className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>
          Mode Dev
        </div>
        <DialogTitle>L&apos;agent veut pousser en prod</DialogTitle>
        <DialogBody className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Le copilote a préparé un commit et demande l&apos;autorisation de faire{' '}
            <code className={cn("rounded px-1 py-0.5 text-xs", adminBgInset)}>git push origin</code> sur la
            branche courante. Confirmer ?
          </p>
          <pre className={cn("rounded-lg p-3 font-mono text-xs max-h-32 overflow-auto", adminBgInset, adminTextMuted)}>
            {JSON.stringify(confirmModal?.input ?? {}, null, 2)}
          </pre>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={cancelPush}>
            Non, j&apos;annule
          </Button>
          <Button color="indigo" onClick={confirmPush}>
            Oui, pousser
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function getModeHint(mode: CopilotMode, storeName: string): string {
  switch (mode) {
    case 'research':
      return 'Cherche une niche, valide la saturation Meta Ads, repère les fournisseurs avant de créer un nouveau store.';
    case 'curation':
      return `Ajoute, retire, repricer, réécrire la copy des produits de ${storeName}.`;
    case 'ads':
      return 'Liste tes variantes, réécris un hook, suggère un ciblage, estime un budget.';
    case 'medias':
      return 'Relance la génération d\'un asset (hero, lifestyle, promo), reviens à une version précédente.';
    case 'dev':
      return 'Décris ce que tu veux changer dans le code. L\'agent lit le repo, propose un patch, lance les tests et commit. Le push reste sous ta confirmation.';
  }
}

// ── Sidebar ─────────────────────────────────────────────────────────────

function Sidebar({
  mode,
  storeSlug,
  products,
}: {
  mode: CopilotMode;
  storeSlug: string;
  products: ProductSummary[];
}) {
  if (mode === 'curation') {
    return (
      <div className="space-y-2">
        <p className={cn("text-xs mb-2", adminTextMuted)}>{products.length} produits en catalogue</p>
        {products.length === 0 ? (
          <p className={cn("text-sm", adminTextMuted)}>Aucun produit.</p>
        ) : (
          products.map((p) => (
            <div key={p.id} className={cn("rounded-lg border p-2 flex gap-2", adminBorder, adminBgInset)}>
              <div className={cn("w-10 h-10 rounded overflow-hidden shrink-0", adminBgInset)}>
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <p className={cn("font-medium line-clamp-2 leading-tight", adminText)}>{p.enriched_title}</p>
                <p className={cn("mt-0.5", adminTextMuted)}>{fmtEur(p.price_cents)}</p>
              </div>
            </div>
          ))
        )}
        <div className="pt-2">
          <Link href={`/shop/${storeSlug}`} target="_blank" className={cn("text-xs hover:underline", adminTextMuted)}>
            Voir le storefront →
          </Link>
        </div>
      </div>
    );
  }
  if (mode === 'ads') {
    return (
      <div className={cn("text-sm space-y-2", adminTextMuted)}>
        <p className={cn("font-medium", adminText)}>Outils dispo</p>
        <ul className="text-xs list-disc pl-4 space-y-1">
          <li>list_variants — voir l&apos;état des ads</li>
          <li>rewrite_hook — réécrire headline + body</li>
          <li>generate_visual — visuel 1:1 via fal.ai</li>
          <li>suggest_targeting — age, intérêts, placements</li>
          <li>estimate_budget — CPM × jours</li>
        </ul>
        <p className="text-xs pt-2">
          Astuce: démarre par &laquo; liste mes variantes &raquo;.
        </p>
      </div>
    );
  }
  if (mode === 'medias') {
    return (
      <div className={cn("text-sm space-y-2", adminTextMuted)}>
        <p className={cn("font-medium", adminText)}>Slots d&apos;assets</p>
        <ul className="text-xs space-y-1">
          {['hero', 'cutout', 'lifestyle-1', 'lifestyle-2', 'lifestyle-3', 'promo'].map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
              <code className="text-xs">{k}</code>
            </li>
          ))}
        </ul>
        <p className="text-xs pt-2">
          Astuce: &laquo; liste les assets &raquo; puis &laquo; régénère le hero &raquo;.
        </p>
      </div>
    );
  }
  if (mode === 'dev') {
    return (
      <div className={cn("text-sm space-y-3", adminTextMuted)}>
        <div>
          <p className={cn("font-medium", adminText)}>Capacités</p>
          <ul className="mt-1 text-xs list-disc pl-4 space-y-0.5">
            <li>read_file / list_files / search_code</li>
            <li>write_file / apply_patch</li>
            <li>run_bash (whitelist: npm, npx, node, git, ls, cat, grep…)</li>
            <li>git_status / git_diff / git_commit</li>
            <li>git_push (confirmation requise)</li>
          </ul>
        </div>
        <div className={cn("pt-3 border-t", adminBorderSoft)}>
          <p className={cn("font-medium", adminText)}>Garde-fous</p>
          <ul className="mt-1 text-xs list-disc pl-4 space-y-0.5">
            <li>Lecture/écriture refusée sur .env*, .git/, node_modules/, .next/</li>
            <li>Commandes interdites: rm -rf, sudo, ssh, scp, mkfs…</li>
            <li>15 boucles max, 20 outils max par tour</li>
            <li>Pas de force-push, pas de --no-verify</li>
          </ul>
        </div>
        <div className={cn("pt-3 text-xs border-t", adminBorderSoft)}>
          Astuce: « ajoute un bouton de partage social sur la page produit ».
        </div>
      </div>
    );
  }
  // research
  return (
    <div className={cn("text-sm space-y-2", adminTextMuted)}>
      <p className={cn("font-medium", adminText)}>Modes utiles</p>
      <ul className="text-xs list-disc pl-4 space-y-1">
        <li>web_search — Tavily</li>
        <li>ask_perplexity — synthèse + citations</li>
        <li>meta_ads_library — saturation</li>
        <li>aliexpress_search / cj_search</li>
        <li>shortlist_niche — recommandation finale</li>
      </ul>
      <p className="text-xs pt-2">
        Astuce: démarre par &laquo; analyse la niche &lt;mot-clé&gt; &raquo;.
      </p>
    </div>
  );
}

// ── Tool cards ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse [animation-delay:120ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse [animation-delay:240ms]" />
    </span>
  );
}

function ToolCard({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(true);
  const isError = !!message.is_error;
  const name = message.tool_name || 'tool';

  return (
    <div className={cn("rounded-xl border text-sm overflow-hidden", adminBorder, adminBgPanel)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left"
      >
        <span className={cn("inline-block w-1.5 h-1.5 rounded-full", isError ? "bg-red-500" : message.tool_output ? "bg-emerald-500" : "bg-zinc-500")} />
        <code className={cn("font-mono text-xs", adminTextMuted)}>{name}</code>
        <span className={cn("ml-auto text-xs line-clamp-1", adminTextMuted)}>{message.content}</span>
        <span className={cn("text-xs", adminTextMuted)}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className={cn("px-4 pb-4 pt-1 space-y-3 border-t", adminBorderSoft)}>
          <SpecialisedRenderer name={name} input={message.tool_input} output={message.tool_output} isError={isError} />
          <details className={cn("text-xs", adminTextMuted)}>
            <summary className="cursor-pointer">Détails techniques</summary>
            <div className="mt-2 space-y-2">
              <div>
                <div className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>input</div>
                <pre className={cn("mt-1 rounded p-2 overflow-x-auto font-mono text-xs", adminBgInset)}>{JSON.stringify(message.tool_input ?? {}, null, 2)}</pre>
              </div>
              <div>
                <div className={cn("text-[10px] uppercase tracking-wide font-semibold", adminTextMuted)}>output</div>
                <pre className={cn("mt-1 rounded p-2 overflow-x-auto font-mono text-xs", adminBgInset)}>{JSON.stringify(message.tool_output ?? {}, null, 2)}</pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function SpecialisedRenderer({
  name,
  input,
  output,
  isError,
}: {
  name: string;
  input: unknown;
  output: unknown;
  isError: boolean;
}) {
  if (!output) return null;
  const out = output as Record<string, unknown>;
  const inp = (input ?? {}) as Record<string, unknown>;

  if (name === 'read_file') {
    const content = typeof out.content === 'string' ? out.content : '';
    const preview = content.split('\n').slice(0, 20).join('\n');
    return (
      <div className="text-xs space-y-1">
        <p className={cn("font-mono", adminTextMuted)}>{String(inp.path ?? '')}</p>
        <pre className={cn("rounded p-3 overflow-x-auto font-mono text-xs", adminBgInset, adminText)}>{preview}{content.split('\n').length > 20 ? '\n…' : ''}</pre>
      </div>
    );
  }
  if (name === 'write_file' || name === 'apply_patch') {
    return (
      <div className="text-xs">
        <p className={cn("font-mono", adminTextMuted)}>{String(inp.path ?? '')}</p>
        <p className={cn("mt-1", adminTextMuted)}>
          {name === 'apply_patch' ? 'Patch appliqué' : `Écriture (${out.bytes ?? '?'} octets)`}
        </p>
      </div>
    );
  }
  if (name === 'run_bash') {
    const stdout = typeof out.stdout === 'string' ? out.stdout : '';
    const stderr = typeof out.stderr === 'string' ? out.stderr : '';
    const exitCode = typeof out.exit_code === 'number' ? out.exit_code : '?';
    return (
      <div className="text-xs space-y-1">
        <p className={cn("font-mono", adminTextMuted)}>$ {String(out.command ?? inp.command ?? '')}</p>
        {stdout && (
          <pre className={cn("rounded p-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap", adminBgInset, adminText)}>{stdout}</pre>
        )}
        {stderr && (
          <pre className={cn("rounded p-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap", adminBgInset, adminTextMuted)}>{stderr}</pre>
        )}
        <p className={cn("font-medium", exitCode === 0 ? "text-emerald-500" : adminTextMuted)}>
          exit {exitCode}
        </p>
      </div>
    );
  }
  if (name === 'git_commit') {
    if (out.empty) return <p className={cn("text-xs", adminTextMuted)}>Rien à commiter.</p>;
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Check size={12} strokeWidth={2.5} aria-hidden />
        <span>commit</span>
        <code className="font-mono">{String(out.short_sha ?? '')}</code>
        <span>{String(out.message ?? '').slice(0, 60)}</span>
      </div>
    );
  }
  if (name === 'git_push') {
    if (out.confirm_required) {
      return (
        <p className="inline-flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
          <Pause size={12} strokeWidth={2.5} aria-hidden />
          En attente de confirmation utilisateur.
        </p>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Rocket size={12} strokeWidth={2} aria-hidden />
        pushed to {String(out.branch ?? 'origin')}
      </div>
    );
  }
  if (name === 'git_status' || name === 'git_diff') {
    const text = typeof out.porcelain === 'string' ? out.porcelain : typeof out.diff === 'string' ? out.diff : '';
    return (
      <pre className={cn("rounded p-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap max-h-72", adminBgInset, adminText)}>{text || '(vide)'}</pre>
    );
  }
  if (name === 'search_code') {
    const matches = Array.isArray(out.matches) ? (out.matches as Array<{ file: string; line: number; content: string }>) : [];
    if (matches.length === 0) return <p className={cn("text-xs", adminTextMuted)}>Aucun match.</p>;
    return (
      <div className="text-xs space-y-0.5 font-mono">
        {matches.slice(0, 12).map((m, i) => (
          <div key={i} className="truncate">
            <span className={adminTextMuted}>{m.file}:{m.line}</span>{' '}
            <span className={adminTextMuted}>{m.content.trim()}</span>
          </div>
        ))}
        {matches.length > 12 && <p className={adminTextMuted}>…et {matches.length - 12} de plus</p>}
      </div>
    );
  }
  if (name === 'list_files') {
    const entries = Array.isArray(out.entries) ? (out.entries as Array<{ path: string; type: string }>) : [];
    return (
      <div className="text-xs font-mono space-y-0.5 max-h-48 overflow-y-auto">
        {entries.slice(0, 30).map((e, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={cn("inline-flex", adminTextMuted)}>
              {e.type === 'dir' ? <Folder size={12} strokeWidth={1.75} aria-hidden /> : <FileText size={12} strokeWidth={1.75} aria-hidden />}
            </span>
            <span>{e.path}</span>
          </div>
        ))}
        {entries.length > 30 && <p className={adminTextMuted}>…et {entries.length - 30} de plus</p>}
      </div>
    );
  }
  if (isError && typeof out.error === 'string') {
    return <p className={cn("text-xs", adminTextMuted)}>{out.error}</p>;
  }
  return null;
}
