import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { loadFactoryStore } from '@/lib/storefront/factory-data';
import { StorefrontRenderer } from '@/components/storefront/StorefrontRenderer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fs = await loadFactoryStore(slug);
  if (!fs) return { title: 'Boutique' };
  return {
    title: `${fs.store.name} — ${fs.store.tagline ?? 'Boutique'}`,
    description: fs.store.description ?? undefined,
  };
}

/**
 * Public storefront. Reads store + products straight from Postgres (GPU1 in
 * factory mode) — no Medusa. Only PUBLISHED stores are visible here; 404
 * otherwise. Unpublished factory stores are QA'd via the admin preview route.
 */
export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fs = await loadFactoryStore(slug);
  if (!fs) notFound();
  return <StorefrontRenderer fs={fs} />;
}
