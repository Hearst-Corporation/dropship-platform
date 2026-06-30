'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TEMPLATE_CATALOG, type StoreTemplate } from '@/lib/template-catalog';

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
    <section className="overflow-hidden rounded-xl bg-gray-800/50 ring-1 ring-white/10">
      <div className="border-b border-white/10 px-5 pb-3 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Storefront</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
          Template <em className="italic text-gray-400">de rendu</em>
        </h3>
        <p className="mt-1.5 max-w-2xl text-xs text-gray-500">
          Choix du layout servi sur <code className="font-mono text-gray-400">/shop/{storeSlug}</code>. Auto suit la
          règle historique. Bascule sur éditorial pour les niches narratives (3 à 6 produits liés par un univers).
        </p>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue(opt.value)}
                disabled={pending}
                className={`relative rounded-lg p-4 text-left ring-1 transition-colors disabled:cursor-not-allowed ${
                  active
                    ? 'bg-indigo-500/10 ring-indigo-500/40'
                    : 'bg-white/5 ring-white/10 hover:bg-white/10'
                }`}
              >
                <div className="mb-0.5 text-sm font-semibold text-white">{opt.label}</div>
                <div className={`text-xs leading-snug ${active ? 'text-gray-300' : 'text-gray-500'}`}>
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
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || pending}
            className="rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saved && !dirty && (
            <span className="text-xs text-indigo-400">Enregistré.</span>
          )}
          {error && <span className="text-xs text-gray-500">{error}</span>}
        </div>
      </div>
    </section>
  );
}
