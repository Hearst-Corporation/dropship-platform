"use client";

import { apiFetch } from "@/lib/client-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/catalyst/button";

interface BatchResult {
  scanned: number;
  processed: number;
  results: {
    medusaOrderId: string;
    status: string;
    ok: boolean;
    error?: string;
  }[];
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
      const res = await apiFetch("/api/agent/orders/dry-run-pending", {
        method: "POST",
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as BatchResult;
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        outline
        onClick={run}
        disabled={busy}
        aria-label="Pré-calculer les dry-runs des commandes payées en attente"
        aria-busy={busy}
      >
        {busy ? "Pré-calcul…" : "Pré-calculer les dry-runs"}
      </Button>
      {result && (
        <span className="text-xs text-zinc-500 text-zinc-400">
          {result.processed} traitée{result.processed > 1 ? "s" : ""} sur{" "}
          {result.scanned} payée{result.scanned > 1 ? "s" : ""}
        </span>
      )}
      {error && (
        <span className="text-xs font-medium text-white">Erreur : {error}</span>
      )}
    </div>
  );
}
