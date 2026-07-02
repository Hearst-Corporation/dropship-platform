"use client";

import { apiFetch } from "@/lib/client-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { Button } from "@/components/catalyst/button";

interface Props {
  orderId: string;
}

/**
 * Manual "I paid this on aliexpress.com" flag. AE has no public API to detect
 * payment, so the merchant clicks this after going through the AE checkout.
 */
export function MarkPaidButton({ orderId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function run() {
    setConfirmOpen(false);
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/agent/orders/${orderId}/mark-paid`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        color="indigo"
        disabled={busy}
        onClick={() => setConfirmOpen(true)}
      >
        {busy ? "…" : "Marquer payée"}
      </Button>
      {error && (
        <span className="max-w-52 text-right text-xs text-zinc-500 text-zinc-400">
          {error}
        </span>
      )}
      <AdminConfirmDialog
        open={confirmOpen}
        title="Confirmer le paiement"
        description="Confirme que tu as bien payé cette commande sur aliexpress.com. Cette action ne paie rien, elle sort juste la commande de la liste « à payer »."
        confirmLabel="J'ai payé"
        onConfirm={run}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
