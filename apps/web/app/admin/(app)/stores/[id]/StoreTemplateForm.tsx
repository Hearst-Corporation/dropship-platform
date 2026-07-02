'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TEMPLATE_CATALOG, type StoreTemplate } from '@/lib/template-catalog';
import { cn } from '@/lib/utils/cn';
import { AdminSection } from '@/components/admin/AdminSection';
import { Button } from '@/components/catalyst/button';

const OPTIONS = TEMPLATE_CATALOG.map((t) => ({
  value: t.id,
  label: t.label,
  hint: t.hint,
}));

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
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: value }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erreur');
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  };

  return (
    <AdminSection
      title="Template de rendu"
      description={`Choix du layout servi sur /shop/${storeSlug}. Auto suit la règle historique. Bascule sur éditorial pour les niches narratives (3 à 6 produits liés par un univers).`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue(opt.value)}
                disabled={pending}
                aria-pressed={active}
                className={cn(
                  'relative rounded-lg p-4 text-left ring-1 transition-colors disabled:cursor-not-allowed',
                  active
                    ? 'bg-indigo-500/10 ring-indigo-500/40'
                    : 'bg-zinc-950/2.5 ring-zinc-950/10 hover:bg-zinc-950/5 dark:bg-white/5 dark:ring-white/10 dark:hover:bg-white/10',
                )}
              >
                <div className="mb-0.5 text-sm font-semibold text-zinc-950 dark:text-white">{opt.label}</div>
                <div
                  className={cn(
                    'text-xs leading-snug',
                    active ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 dark:text-zinc-400',
                  )}
                >
                  {opt.hint}
                </div>
                {active && (
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-indigo-400" aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="button" color="indigo" onClick={submit} disabled={!dirty || pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {saved && !dirty && (
            <span className="text-xs text-indigo-600 dark:text-indigo-400">Enregistré.</span>
          )}
          {error && (
            <span className="text-xs font-medium text-zinc-950 dark:text-white">
              Erreur : {error}
            </span>
          )}
        </div>
      </div>
    </AdminSection>
  );
}
