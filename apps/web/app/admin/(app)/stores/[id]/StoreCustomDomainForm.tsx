'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
export function StoreCustomDomainForm({
  storeId,
  initial,
}: {
  storeId: string;
  initial: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value.trim() !== initial.trim();
  useUnsavedChanges(dirty && !pending);

  const submit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await apiFetch(`/api/agent/stores/${storeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customDomain: value.trim() }),
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
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Domaine</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
          Domaine <em className="italic text-gray-400">personnalisé</em>
        </h3>
        <p className="mt-1.5 max-w-2xl text-xs text-gray-500">
          Saisir le domaine apex (ex.{' '}
          <code className="font-mono text-gray-400">maison-chic.com</code>). Les visites sur ce
          domaine seront servies en tant que{' '}
          <code className="font-mono text-gray-400">/shop/{'{slug}'}</code> sans redirection.
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <label htmlFor="custom-domain" className="mb-1.5 block text-xs font-medium text-white">
            Domaine
          </label>
          <input
            id="custom-domain"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="maison-chic.com"
            disabled={pending}
            className="block w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 disabled:opacity-50 sm:w-80"
          />
        </div>

        <div className="max-w-lg space-y-1 rounded-lg bg-white/5 p-3 text-xs text-gray-400 ring-1 ring-white/10">
          <p className="font-medium text-white">Configuration DNS requise</p>
          <p>
            Pointer votre DNS A/CNAME vers{' '}
            <code className="font-mono text-gray-400">cname.vercel-dns.com</code>, puis ajouter le
            domaine dans <strong className="text-white">Vercel &rarr; Domains</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || pending}
            className="rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {dirty && !pending && (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              Non sauvegardé
            </span>
          )}
          {saved && !dirty && (
            <span className="text-xs text-indigo-400">Enregistré.</span>
          )}
          {error && <span className="text-xs text-gray-500">{error}</span>}
        </div>
      </div>
    </section>
  );
}
