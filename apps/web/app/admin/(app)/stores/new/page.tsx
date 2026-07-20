'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text';
import {
  adminBgInset,
  adminBgPanel,
  adminBorder,
  adminBorderSoft,
  adminText,
  adminTextMuted,
} from '@/components/admin/admin-surface';
import { cn } from '@/lib/utils/cn';
import type { StoreTemplate } from '@/lib/template-catalog';
import { NicheResearchCopilot, type ShortlistPayload } from './NicheResearchCopilot';

type DesignPresetSlug = NonNullable<ShortlistPayload['design_proposals']>[number]['preset'];

interface AgentEvent {
  type: 'step' | 'progress' | 'success' | 'error' | 'done';
  message: string;
  data?: Record<string, unknown>;
}

interface LogLine {
  id: number;
  type: AgentEvent['type'];
  message: string;
  ts: string;
}

interface LaunchOverrides {
  niche?: string;
  storeName?: string;
  mode?: 'mono' | 'collection';
  maxProducts?: number;
  language?: 'fr' | 'en';
  skipVideo?: boolean;
  skipAudio?: boolean;
  lifestyleImageCount?: number;
  designPreset?: DesignPresetSlug;
  primaryColor?: string;
  accentColor?: string;
  template?: StoreTemplate;
  brief?: string;
  markets?: string[];
}

function NewStoreForm() {
  const searchParams = useSearchParams();
  const [niche, setNiche] = useState('');
  const [storeName, setStoreName] = useState('');
  const [mode, setMode] = useState<'mono' | 'collection'>('mono');
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [skipVideo, setSkipVideo] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [result, setResult] = useState<{ slug: string; storeName: string; productCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const counterRef = useRef(0);
  const startTimeRef = useRef(0);

  // Prefill from query string (used by "recréer ce store" link)
  useEffect(() => {
    const n = searchParams.get('niche');
    const s = searchParams.get('name');
    if (n) setNiche(n);
    if (s) setStoreName(s);
  }, [searchParams]);

  // Elapsed timer
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  const addLog = (event: AgentEvent) => {
    const line: LogLine = {
      id: counterRef.current++,
      type: event.type,
      message: event.message,
      ts: new Date().toLocaleTimeString(),
    };
    setLogs((prev) => [...prev, line]);

    if (event.type === 'step' || event.type === 'progress') {
      setCurrentStep(event.message);
    }
    if (event.type === 'step') setProgress((p) => Math.min(p + 12, 80));
    if (event.type === 'progress' && event.data?.imported && event.data?.total) {
      const pct = Math.round((Number(event.data.imported) / Number(event.data.total)) * 100);
      setProgress(70 + Math.round(pct * 0.27));
    }
    if (event.type === 'success') {
      setProgress(100);
      setCurrentStep('');
    }
  };

  /**
   * Kick off store creation. Reads from local state by default, but an
   * `overrides` payload wins — that's how the shortlist card launches
   * directly without depending on React state propagation (setMode is
   * async, the value isn't there yet on the next render).
   */
  const launch = async (overrides?: LaunchOverrides) => {
    const eff = {
      niche: overrides?.niche ?? niche,
      storeName: overrides?.storeName ?? storeName,
      mode: overrides?.mode ?? mode,
      language: overrides?.language ?? language,
      skipVideo: overrides?.skipVideo ?? skipVideo,
      ...(overrides?.maxProducts !== undefined && { maxProducts: overrides.maxProducts }),
      ...(overrides?.skipAudio !== undefined && { skipAudio: overrides.skipAudio }),
      ...(overrides?.lifestyleImageCount !== undefined && {
        lifestyleImageCount: overrides.lifestyleImageCount,
      }),
      ...(overrides?.designPreset && { designPreset: overrides.designPreset }),
      ...(overrides?.primaryColor && { primaryColor: overrides.primaryColor }),
      ...(overrides?.accentColor && { accentColor: overrides.accentColor }),
      ...(overrides?.template && { template: overrides.template }),
      ...(overrides?.brief && { brief: overrides.brief }),
      ...(overrides?.markets && { markets: overrides.markets }),
    };
    if (!eff.niche.trim() || !eff.storeName.trim()) return;
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);
    setProgress(4);
    setCurrentStep('Démarrage…');
    setElapsed(0);
    startTimeRef.current = Date.now();
    // Persist the values too so the form reflects what's running and the
    // operator can edit-and-retry if creation fails.
    setNiche(eff.niche);
    setStoreName(eff.storeName);
    setMode(eff.mode);

    try {
      const res = await apiFetch('/api/agent/create-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eff),
      });

      if (!res.ok || !res.body) {
        setError('Erreur serveur. Vérifie ANTHROPIC_API_KEY dans Réglages.');
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as AgentEvent;
            addLog(event);
            if (event.type === 'success' && event.data) {
              setResult({
                slug: event.data.slug as string,
                storeName: event.data.storeName as string,
                productCount: event.data.productCount as number,
              });
            }
            if (event.type === 'error') setError(event.message);
          } catch {}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    }
    setRunning(false);
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setLogs([]);
    setProgress(0);
    setCurrentStep('');
    setElapsed(0);
    setNiche('');
    setStoreName('');
  };

  // Apply a shortlist payload from the research copilot — fires
  // create-store directly. Plain function (no useCallback) so it always
  // captures the freshest `launch` closure; the cost of an extra child
  // render is negligible compared to the bug of a stale closure that
  // silently no-ops.
  const applyShortlist = (payload: ShortlistPayload) => {
    const effMode: 'mono' | 'collection' =
      payload.suggested_mode === 'mono' || payload.suggested_mode === 'collection'
        ? payload.suggested_mode
        : 'mono';
    const niche = payload.niche?.trim();
    const storeName = payload.suggested_store_name?.trim();
    if (!niche || !storeName) {
      console.error('[applyShortlist] payload missing niche/storeName', payload);
      setError('Shortlist invalide (niche ou nom manquant). Relance une session.');
      return;
    }
    // The picker writes the operator's choice into design_proposals[0].
    // Everything downstream reads from that single entry — including the
    // store-creator UPDATE that freezes design_preset + palette in DB.
    const chosen = payload.design_proposals?.[0];
    launch({
      niche,
      storeName,
      mode: effMode,
      ...(chosen && {
        designPreset: chosen.preset,
        primaryColor: chosen.primary,
        accentColor: chosen.accent,
      }),
      ...(payload.suggested_template && { template: payload.suggested_template }),
    }).catch((e) => {
      console.error('[applyShortlist] launch failed', e);
      setError(e instanceof Error ? e.message : 'Erreur de lancement');
    });
  };

  const isActive = running || !!result || !!error;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* Quand la création tourne : plein écran dédié impossible à rater */}
      {isActive ? (
        <CreationScreen
          running={running}
          percent={progress}
          elapsed={elapsed}
          currentStep={currentStep}
          storeName={storeName}
          logs={logs}
          result={result}
          error={error}
          onReset={reset}
        />
      ) : (
        /* Copilote recherche de niche */
        <NicheResearchCopilot
          onApplyShortlist={applyShortlist}
          mode={mode}
          onModeChange={setMode}
          language={language}
          onLanguageChange={setLanguage}
          skipVideo={skipVideo}
          onSkipVideoChange={setSkipVideo}
          creationProgress={null}
        />
      )}
    </div>
  );
}

function CreationScreen({
  running,
  percent,
  elapsed,
  currentStep,
  storeName,
  logs,
  result,
  error,
  onReset,
}: {
  running: boolean;
  percent: number;
  elapsed: number;
  currentStep: string;
  storeName: string;
  logs: LogLine[];
  result: { slug: string; storeName: string; productCount: number } | null;
  error: string | null;
  onReset: () => void;
}) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (result) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className={cn("text-xl font-semibold tracking-tight", adminText)}>{result.storeName}</h2>
          <p className={cn("mt-1 text-[13px]", adminTextMuted)}>{result.productCount} produit{result.productCount > 1 ? 's' : ''} import&eacute;{result.productCount > 1 ? 's' : ''} &middot; pr&ecirc;t &agrave; vendre</p>
        </div>
        <div className="flex items-center gap-3">
          <Button href={`/shop/${result.slug}`} target="_blank" color="indigo">
            Ouvrir le store &rarr;
          </Button>
          <Button href="/admin/stores" outline>
            Voir tous les stores
          </Button>
          <Button onClick={onReset} plain>
            Cr&eacute;er un autre
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col flex-1 min-h-0 rounded-xl border overflow-hidden", adminBorder, adminBgPanel)}>
      {/* Header */}
      <div className={cn("shrink-0 flex items-center justify-between gap-4 px-5 py-2.5 border-b", adminBorder)}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", running ? "bg-indigo-500 animate-pulse" : "bg-red-500")} />
          <span className={cn("truncate text-[13px] font-semibold", adminText)}>
            {running ? `Construction de « ${storeName} »` : `Erreur — « ${storeName} »`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {running && (
            <span className={cn("text-xs font-medium tabular-nums", adminTextMuted)}>
              {percent}% &middot; {elapsed}s
            </span>
          )}
          {error && (
            <Button outline onClick={onReset}>
              R&eacute;essayer
            </Button>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      <div className={cn("h-0.5 shrink-0", adminBgInset)}>
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>

      {/* Étape courante */}
      {currentStep && (
        <div className={cn("shrink-0 border-b px-5 py-2", adminBorderSoft, adminBgInset)}>
          <p className={cn("truncate text-xs italic", adminTextMuted)}>{currentStep}</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="shrink-0 border-b border-red-500/30 bg-red-500/5 px-5 py-3">
          <p className="text-[13px] font-medium text-red-600 dark:text-red-400">Erreur de cr&eacute;ation</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-red-600/90 dark:text-red-400/90">{error}</p>
        </div>
      )}

      {/* Logs en temps réel */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-5 py-4 font-mono text-xs">
        {logs.map((l) => (
          <div key={l.id} className="flex items-start gap-3">
            <span className={cn("shrink-0 pt-px tabular-nums", adminTextMuted)}>{l.ts}</span>
            <span
              className={cn(
                l.type === 'error'
                  ? "text-red-500"
                  : l.type === 'success'
                  ? "text-emerald-500"
                  : l.type === 'step'
                  ? cn(adminText, "font-medium")
                  : adminTextMuted,
              )}
            >
              {l.type === 'step' && <span className={cn("mr-1.5", adminTextMuted)}>&rsaquo;</span>}
              {l.message}
            </span>
          </div>
        ))}
        {running && logs.length === 0 && (
          <p className={adminTextMuted}>D&eacute;marrage&hellip;</p>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

export default function NewStorePage() {
  // Bound the page to the viewport height (minus the SidebarLayout <main>
  // vertical padding) so the chat fills it and its composer sticks to the
  // bottom while the messages scroll above. min-h-0 lets the flex child
  // (the chat section) actually shrink and own the scroll.
  return (
    <div className="flex h-[calc(100svh-5rem)] min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <p className="text-sm/6">
          <TextLink href="/admin/stores">&larr; Stores</TextLink>
        </p>
        <AdminPageHeader
          className="!pb-0"
          title="Nouveau store"
          subtitle="Discute avec le copilote pour trouver une niche, il construit le store de bout en bout."
        />
      </div>
      <Suspense fallback={<div className="text-sm text-zinc-400">Chargement&hellip;</div>}>
        <NewStoreForm />
      </Suspense>
    </div>
  );
}
