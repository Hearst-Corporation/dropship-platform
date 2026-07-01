'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
interface BatchResult {
  scanned: number;
  processed: number;
  results: { medusaOrderId: string; status: string; ok: boolean; error?: string }[];
}

export function DryRunPendingButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await apiFetch('/api/agent/orders/dry-run-pending', { method: 'POST' });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as BatchResult;
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={run}
        disabled={busy}
        aria-label="Pré-calculer les dry-runs des commandes payées en attente"
        aria-busy={busy}
        className="rounded-lg bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-wider text-white ring-1 ring-inset ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Pré-calcul…' : 'Pré-calculer les dry-runs'}
      </button>
      {result && (
        <span className="text-xs text-gray-400">
          {result.processed} traitée{result.processed > 1 ? 's' : ''} sur {result.scanned} payée{result.scanned > 1 ? 's' : ''}
        </span>
      )}
      {error && <span className="text-xs text-gray-400">{error}</span>}
    </div>
  );
}
