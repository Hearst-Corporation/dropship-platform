import { Suspense } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { TextLink } from '@/components/catalyst/text';
import { NewStoreForm } from './NewStoreForm';

export default function NewStorePage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm/6">
          <TextLink href="/admin/stores">&larr; Stores</TextLink>
        </p>
        <AdminPageHeader
          className="!pb-0"
          title="Nouveau store"
          subtitle="Renseigne une niche et un nom, l'agent construit le store de bout en bout."
        />
      </div>
      <Suspense fallback={<div className="text-sm text-zinc-400">Chargement&hellip;</div>}>
        <NewStoreForm />
      </Suspense>
    </div>
  );
}
