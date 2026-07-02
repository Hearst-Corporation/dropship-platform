'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { AdminSection } from '@/components/admin/AdminSection';
import { Button } from '@/components/catalyst/button';
import { Field, Label, Description } from '@/components/catalyst/fieldset';
import { Input } from '@/components/catalyst/input';
import { Code, Strong } from '@/components/catalyst/text';

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
    <AdminSection
      title="Domaine personnalisé"
      description="Saisir le domaine apex (ex. maison-chic.com). Les visites sur ce domaine seront servies en tant que /shop/{slug} sans redirection."
    >
      <div className="space-y-4">
        <Field className="max-w-sm" disabled={pending}>
          <Label>Domaine</Label>
          <Input
            id="custom-domain"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="maison-chic.com"
            autoComplete="off"
            spellCheck={false}
          />
          <Description>
            Pointer votre DNS A/CNAME vers <Code>cname.vercel-dns.com</Code>, puis ajouter le
            domaine dans <Strong>Vercel &rarr; Domains</Strong>.
          </Description>
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <Button type="button" color="indigo" onClick={submit} disabled={!dirty || pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {dirty && !pending && (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
              Non sauvegardé
            </span>
          )}
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
