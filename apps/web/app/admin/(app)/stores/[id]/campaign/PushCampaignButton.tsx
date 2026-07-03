"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/catalyst/button";

/**
 * Client button that POSTs the deterministic campaign push to the agent API.
 *
 * This is a real outward-facing action (it creates a campaign on Google Ads,
 * PAUSED — no auto-spend), so it uses a two-click confirm before firing:
 * first click arms "Confirmer le lancement", second click POSTs. Auth is the
 * Basic Auth middleware on /api/agent/*.
 */
export interface PushCampaignButtonProps {
  storeId: string;
  campaignId?: string;
  label?: string;
}

type PushResponse = {
  success?: boolean;
  externalId?: string | null;
  status?: string;
  message?: string;
  error?: string;
};

export function PushCampaignButton({
  storeId,
  campaignId,
  label = "Lancer la campagne (Google Ads)",
}: PushCampaignButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<{ externalId?: string | null; message?: string } | null>(null);

  async function onPush() {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/agent/stores/${storeId}/campaign/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignId ? { campaignId, channel: "google" } : { channel: "google" }),
      });
      const data = (await res.json().catch(() => ({}))) as PushResponse;
      if (!res.ok || data.success === false) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setOk({ externalId: data.externalId, message: data.message });
      setArmed(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le lancement a échoué. Réessaie.");
      setArmed(false);
    } finally {
      setPending(false);
    }
  }

  if (ok) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <p className="text-sm/6 text-white">
          Campagne poussée en PAUSE sur Google Ads
          {ok.externalId ? ` (id ${ok.externalId})` : ""}.
        </p>
        <p className="text-xs/5 text-zinc-500 text-zinc-400">
          {ok.message ??
            "Aucune dépense automatique. Active-la dans l interface Google Ads après vérification."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {armed ? (
        <div className="flex items-center gap-2">
          <Button color="indigo" disabled={pending} onClick={onPush}>
            {pending ? "Lancement…" : "Confirmer le lancement"}
          </Button>
          <Button plain disabled={pending} onClick={() => setArmed(false)}>
            Annuler
          </Button>
        </div>
      ) : (
        <Button color="indigo" disabled={pending} onClick={() => setArmed(true)}>
          {label}
        </Button>
      )}
      {armed ? (
        <p className="text-xs/5 text-zinc-500 text-zinc-400">
          La campagne sera créée en PAUSE sur Google Ads (aucune dépense automatique).
        </p>
      ) : null}
      {error ? (
        <p className="text-xs/5 text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

export default PushCampaignButton;
