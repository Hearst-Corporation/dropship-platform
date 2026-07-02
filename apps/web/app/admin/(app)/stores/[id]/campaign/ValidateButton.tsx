"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/catalyst/button";

/**
 * Small client button that POSTs a validation (budget or calendar) to the
 * agent API, then refreshes the server page so the "Validé le …" badge
 * replaces the button. Auth is handled by the Basic Auth middleware on
 * /api/agent/*.
 */
export interface ValidateButtonProps {
  storeId: string;
  kind: "budget" | "calendar";
  label?: string;
}

export function ValidateButton({
  storeId,
  kind,
  label = "Valider",
}: ValidateButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onValidate() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/agent/stores/${storeId}/campaign/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      setError("La validation a échoué. Réessaie.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button color="indigo" disabled={pending} onClick={onValidate}>
        {pending ? "Validation…" : label}
      </Button>
      {error ? (
        <p className="text-xs/5 text-zinc-500 text-zinc-400">{error}</p>
      ) : null}
    </div>
  );
}

export default ValidateButton;
