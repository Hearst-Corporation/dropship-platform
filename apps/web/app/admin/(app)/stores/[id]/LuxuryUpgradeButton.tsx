"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/catalyst/button";
import { Code, Strong } from "@/components/catalyst/text";

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
    <section className="overflow-hidden rounded-xl bg-gray-800/50 ring-1 ring-indigo-500/20">
      <div className="border-b border-indigo-500/20 px-5 pb-3 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-400">
          Passage en mode luxe
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
          Upgrade éditorial{" "}
          <em className="italic text-gray-400">de toute la boutique</em>
        </h3>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-gray-500">
          Re-rend hero, cutout, lifestyle (×3) et packaging via fal.ai en
          composition studio luxe. Réécrit la copy en voix maison (Hermès /
          Aesop / Le Labo). Bascule le template sur{" "}
          <code className="font-mono text-gray-400">luxury-mono</code> et
          propose un prix de vente à 15-20× le coût fournisseur.
        </p>
      </div>
      <div className="space-y-3 p-5">
        <ul className="space-y-1.5 text-xs leading-relaxed text-gray-400">
          <li>· 6 visuels régénérés (≈ 60s) + 1 vidéo hero 5s (≈ 60s)</li>
          <li>· Copy littéraire FR (hero, story, atelier, packaging, CTA)</li>
          <li>
            · Template basculé sur <Code>luxury-mono</Code> automatiquement
          </li>
          <li>· Coût indicatif : ≈ 0,55 € par run (fal + Claude Opus)</li>
        </ul>

        {!confirming ? (
          <Button
            type="button"
            color="indigo"
            onClick={() => setConfirming(true)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-400/20 text-xs text-indigo-200">
              →
            </span>
            {isLuxury ? "Re-générer en mode luxe" : "Passer en mode luxe"}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              color="indigo"
              onClick={run}
              disabled={pending}
              className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
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
          <p className="rounded-md bg-gray-900/50 px-3 py-2 text-xs text-gray-400 ring-1 ring-white/[0.08]">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
