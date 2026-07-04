"use client";

import { apiFetch } from "@/lib/client-fetch";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type StoreTemplate } from "@/lib/template-catalog";
import { AdminSection } from "@/components/admin/AdminSection";
import { TemplatePicker } from "@/components/admin/TemplatePicker";
import { Button } from "@/components/catalyst/button";

type Template = StoreTemplate;

export function StoreTemplateForm({
  storeId,
  storeSlug,
  initial,
}: {
  storeId: string;
  storeSlug: string;
  initial: Template;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<Template>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== initial;

  const submit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await apiFetch(`/api/agent/stores/${storeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template: value }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Erreur");
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  return (
    <AdminSection
      title="Template de rendu"
      description={`Choix du layout servi sur /shop/${storeSlug}. Auto suit la règle historique. Bascule sur éditorial pour les niches narratives (3 à 6 produits liés par un univers).`}
    >
      <div className="space-y-4">
        <TemplatePicker
          value={value}
          onChange={setValue}
          disabled={pending}
          excludeAuto={false}
        />

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            color="indigo"
            onClick={submit}
            disabled={!dirty || pending}
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          {saved && !dirty && (
            <span className="text-xs text-indigo-400">Enregistré.</span>
          )}
          {error && (
            <span className="text-xs font-medium text-white">
              Erreur : {error}
            </span>
          )}
        </div>
      </div>
    </AdminSection>
  );
}
