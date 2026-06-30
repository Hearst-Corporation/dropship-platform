import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminCard } from '@/components/admin/AdminCard';

export const dynamic = 'force-dynamic';

/**
 * Template preview — the 24 bespoke landing templates were removed (audit
 * cleanup). Stores now render the generic storefront (hero + product grid),
 * so there is no per-template preview to show. Kept as a route so existing
 * links don't 404.
 */
export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={
          <Link href="/admin/templates" className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300">
            <ChevronLeftIcon className="size-4" aria-hidden /> Templates
          </Link>
        }
        title="Aperçu indisponible"
        description={`Le template « ${id} » n'a plus d'aperçu : les designs sur mesure ont été retirés.`}
      />
      <AdminCard className="px-6 py-16 text-center">
        <p className="text-sm font-semibold text-white">Storefront générique</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
          Toutes les boutiques rendent désormais le storefront standard (hero + grille produits)
          piloté par la palette du store. Il n&apos;y a plus de templates sur mesure à prévisualiser.
        </p>
      </AdminCard>
    </div>
  );
}
