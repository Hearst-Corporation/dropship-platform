"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { Code, Strong } from "@/components/ui/text";

/**
 * One-click luxury upgrade — re-renders the store's visuals through fal.ai
 * with editorial prompts, regenerates the copy in luxury brand voice, and
 * flips the template to `luxury-mono`. Single network call, takes 60-120s.
 */
export function LuxuryUpgradeButton({
  storeId,
  currentTemplate,
}: {
  storeId: string;
  currentTemplate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const isLuxury = currentTemplate === "luxury-mono";

  const run = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await apiFetch(
          `/api/agent/stores/${storeId}/luxury-upgrade`,
          {
            method: "POST",
          },
        );
        const data = await res.json();
        if (!res.ok || !data.success)
          throw new Error(data.error || "Échec du pipeline");
        const price = data.result?.suggestedPriceEuros;
        setSuccess(
          price
            ? `Boutique transformée. Prix suggéré : ${price} €.`
            : "Boutique transformée. Visuels, copy et template à jour.",
        );
        setConfirming(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inattendue");
        setConfirming(false);
      }
    });
  };

  return (
    <AdminSection
      title="Passage en mode luxe"
      highlight
      description="Re-rend hero, cutout, lifestyle (×3) et packaging via fal.ai. Réécrit la copy en voix maison. Bascule le template sur luxury-mono."
    >
      <div className="space-y-3">
        <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-400">
          <li>· 6 visuels régénérés (≈ 60s) + 1 vidéo hero 5s (≈ 60s)</li>
          <li>· Copy littéraire FR (hero, story, atelier, packaging, CTA)</li>
          <li>
            · Template basculé sur <Code>luxury-mono</Code> automatiquement
          </li>
          <li>· Coût indicatif : ≈ 0,55 € par run (fal + GPT-4o)</li>
        </ul>

        {!confirming ? (
          <Button
            type="button"
            color="indigo"
            onClick={() => setConfirming(true)}
            disabled={pending}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-400/20 text-xs text-indigo-200">
              →
            </span>
            {isLuxury ? "Re-générer en mode luxe" : "Passer en mode luxe"}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="button" color="indigo" onClick={run} disabled={pending}>
              {pending
                ? "Pipeline en cours… (60-120s)"
                : "Confirmer le lancement"}
            </Button>
            <Button
              type="button"
              plain
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Annuler
            </Button>
          </div>
        )}

        {success && (
          <p className="rounded-md bg-indigo-500/10 px-3 py-2 text-xs text-indigo-400 ring-1 ring-indigo-500/20 text-indigo-400">
            {success}
          </p>
        )}
        {error && (
          <p className="rounded-md bg-admin-surface-inset px-3 py-2 text-xs text-zinc-400 ring-1 ring-admin-ring">
            {error}
          </p>
        )}
      </div>
    </AdminSection>
  );
}
