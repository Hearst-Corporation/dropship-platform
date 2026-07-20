import { notFound } from 'next/navigation';
import { loadFactoryStore } from '@/lib/storefront/factory-data';
import { StorefrontRenderer } from '@/components/storefront/StorefrontRenderer';

export const dynamic = 'force-dynamic';

/**
 * Admin storefront preview. Behind Basic Auth (middleware covers /admin/*),
 * outside the (app) group so it renders full-page without the admin sidebar.
 * Loads ANY status (preview: true) so a factory store that isn't published
 * yet can be QA'd exactly as it will look live.
 *
 * `?template=<blueprintId>` (admin-only) previews any blueprint against this
 * store's real data — read-only, nothing is written back.
 */
export default async function AdminPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { slug } = await params;
  const { template } = await searchParams;
  const fs = await loadFactoryStore(slug, { preview: true });
  if (!fs) notFound();
  return <StorefrontRenderer fs={fs} preview blueprintOverrideId={template} />;
}
