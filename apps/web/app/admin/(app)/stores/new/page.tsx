'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/20/solid';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/AdminCard';

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

function NewStoreForm() {
  const searchParams = useSearchParams();
  const [niche, setNiche] = useState('');
  const [storeName, setStoreName] = useState('');
  const [mode, setMode] = useState<'mono' | 'collection'>('mono');
  const [maxProducts] = useState(10);
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
   * `overrides` payload wins.
   */
  const launch = async (overrides?: {
    niche?: string;
    storeName?: string;
    mode?: 'mono' | 'collection';
    maxProducts?: number;
    language?: 'fr' | 'en';
    skipVideo?: boolean;
  }) => {
    const eff = {
      niche: overrides?.niche ?? niche,
      storeName: overrides?.storeName ?? storeName,
      mode: overrides?.mode ?? mode,
      maxProducts: overrides?.maxProducts ?? maxProducts,
      language: overrides?.language ?? language,
      skipVideo: overrides?.skipVideo ?? skipVideo,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    launch().catch((err) => {
      console.error('[launch] failed', err);
      setError(err instanceof Error ? err.message : 'Erreur de lancement');
    });
  };

  const canSubmit = niche.trim().length > 0 && storeName.trim().length > 0 && !running;
  const isActive = running || !!result || !!error;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={
          <Link href="/admin/stores" className="text-indigo-400 hover:text-indigo-300">
            &larr; Stores
          </Link>
        }
        title="Nouveau store"
        description="Renseigne une niche et un nom, l’agent construit le store de bout en bout."
      />

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
        <div className="mx-auto w-full max-w-2xl">
          <AdminCard>
            <AdminCardHeader eyebrow="Création" title="Configurer le store" />
            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <div>
                <label htmlFor="niche" className="block text-sm font-medium text-white">
                  Niche
                </label>
                <p className="mt-1 text-sm text-gray-400">
                  Le mot-clé produit ou thème autour duquel l’agent construit le store.
                </p>
                <input
                  id="niche"
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="ex. lampes de bureau design"
                  autoFocus
                  className="mt-2 block w-full rounded-md bg-white/5 px-3 py-2 text-base text-white outline-none ring-1 ring-inset ring-white/10 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="storeName" className="block text-sm font-medium text-white">
                  Nom du store
                </label>
                <input
                  id="storeName"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="ex. Lueur Studio"
                  className="mt-2 block w-full rounded-md bg-white/5 px-3 py-2 text-base text-white outline-none ring-1 ring-inset ring-white/10 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="mode" className="block text-sm font-medium text-white">
                    Mode
                  </label>
                  <select
                    id="mode"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as 'mono' | 'collection')}
                    className="mt-2 block w-full rounded-md bg-white/5 px-3 py-2 text-base text-white outline-none ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="mono" className="bg-gray-800">Mono-produit</option>
                    <option value="collection" className="bg-gray-800">Collection</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-white">
                    Langue
                  </label>
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
                    className="mt-2 block w-full rounded-md bg-white/5 px-3 py-2 text-base text-white outline-none ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="fr" className="bg-gray-800">Français</option>
                    <option value="en" className="bg-gray-800">English</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="skipVideo"
                  type="checkbox"
                  checked={skipVideo}
                  onChange={(e) => setSkipVideo(e.target.checked)}
                  className="size-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
                />
                <label htmlFor="skipVideo" className="text-sm text-gray-400">
                  Ignorer la génération vidéo (création plus rapide)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-6">
                <Link
                  href="/admin/stores"
                  className="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 hover:text-white"
                >
                  Annuler
                </Link>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Créer le store
                </button>
              </div>
            </form>
          </AdminCard>
        </div>
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
      <div className="mx-auto w-full max-w-2xl">
        <AdminCard className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20">
            <CheckCircleIcon className="size-7 text-green-400" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-white">{result.storeName}</h2>
          <p className="mt-1 text-sm text-gray-400">
            {result.productCount} produit{result.productCount > 1 ? 's' : ''} importé
            {result.productCount > 1 ? 's' : ''} &middot; prêt à vendre
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href={`/shop/${result.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400"
            >
              Ouvrir le store
              <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/admin/stores"
              className="rounded-md bg-white/5 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Voir tous les stores
            </Link>
            <button
              type="button"
              onClick={onReset}
              className="rounded-md px-3.5 py-2 text-sm font-semibold text-gray-400 hover:text-white"
            >
              Créer un autre
            </button>
          </div>
        </AdminCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <AdminCard className="overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`size-2 flex-shrink-0 rounded-full ${running ? 'animate-pulse bg-indigo-400' : 'bg-red-400'}`}
              aria-hidden="true"
            />
            <span className="truncate text-sm font-semibold text-white">
              {running ? `Construction de « ${storeName} »` : `Erreur — « ${storeName} »`}
            </span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            {running && (
              <span className="text-xs font-medium tabular-nums text-gray-400">
                {percent}% &middot; {elapsed}s
              </span>
            )}
            {error && (
              <button
                type="button"
                onClick={onReset}
                className="rounded-md bg-white/5 px-3 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-white/10 hover:text-white"
              >
                Réessayer
              </button>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full bg-indigo-500 transition-[width] duration-500"
            style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
          />
        </div>

        {/* Étape courante */}
        {currentStep && (
          <div className="border-b border-white/10 bg-white/5 px-5 py-2">
            <p className="truncate text-xs italic text-gray-400">{currentStep}</p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-400">
              <ExclamationTriangleIcon className="size-4" aria-hidden="true" />
              Erreur de création
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-red-400/80">{error}</p>
          </div>
        )}

        {/* Logs en temps réel */}
        <div className="flex max-h-[60vh] min-h-[16rem] flex-col gap-1.5 overflow-y-auto px-5 py-4 font-mono text-xs">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3">
              <span className="flex-shrink-0 pt-px tabular-nums text-gray-500">{l.ts}</span>
              <span
                className={
                  l.type === 'error'
                    ? 'text-red-400'
                    : l.type === 'success'
                      ? 'text-green-400'
                      : l.type === 'step'
                        ? 'font-medium text-white'
                        : 'text-gray-400'
                }
              >
                {l.type === 'step' && <span className="mr-1.5 text-gray-500">&rsaquo;</span>}
                {l.message}
              </span>
            </div>
          ))}
          {running && logs.length === 0 && <p className="text-gray-500">Démarrage&hellip;</p>}
          <div ref={logsEndRef} />
        </div>
      </AdminCard>
    </div>
  );
}

export default function NewStorePage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400">Chargement&hellip;</div>}>
      <NewStoreForm />
    </Suspense>
  );
}
