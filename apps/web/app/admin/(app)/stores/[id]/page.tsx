import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { StoreAvatar } from '@/components/ui';
import { StoreActions } from '../StoreActions';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatGrid, AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminCard, AdminCardHeader } from '@/components/admin/AdminCard';
import { AdminBadge } from '@/components/admin/AdminBadge';

export const dynamic = 'force-dynamic';

interface StoreDetailRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  tagline: string;
  description: string;
  logo_emoji: string;
  primary_color: string;
  accent_color: string;
  status: string;
  product_count: number;
  medusa_sales_channel_id: string | null;
  medusa_publishable_key: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  ga4_measurement_id: string | null;
  ga4_api_secret: string | null;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_events_token: string | null;
  clarity_id: string | null;
  google_ads_conversion_action: string | null;
  google_merchant_id: string | null;
  template: 'auto' | 'mono' | 'collection-grid' | 'collection-editorial';
  custom_domain: string | null;
}

interface ProductRow {
  id: string;
  supplier: string;
  enriched_title: string;
  enriched_description: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  supplier_url: string | null;
  medusa_product_id: string | null;
  created_at: string;
}

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  const [storeRes, productsRes] = await Promise.all([
    db.query<StoreDetailRow>(
      `SELECT id, slug, name, niche, tagline, description, logo_emoji, primary_color, accent_color,
            status, product_count, medusa_sales_channel_id, medusa_publishable_key,
            error_message, created_at, updated_at,
            ga4_measurement_id, ga4_api_secret,
            meta_pixel_id, meta_capi_token,
            tiktok_pixel_id, tiktok_events_token, clarity_id,
            google_ads_conversion_action, google_merchant_id,
            template, custom_domain
     FROM dropship_stores WHERE id = $1 LIMIT 1`,
      [storeId],
    ),
    db.query<ProductRow>(
      `SELECT id, supplier, enriched_title, enriched_description, price_cents, cost_cents,
            image_url, supplier_url, medusa_product_id, created_at
     FROM dropship_store_products WHERE store_id = $1 ORDER BY created_at ASC LIMIT 500`,
      [storeId],
    ),
  ]);

  const store = storeRes.rows[0];
  if (!store) notFound();

  const products = productsRes.rows;

  const margin = products.length > 0
    ? products.reduce((sum, p) => sum + (p.price_cents - p.cost_cents), 0) / products.length / 100
    : 0;

  const avgPrice = products.length > 0
    ? products.reduce((sum, p) => sum + p.price_cents, 0) / products.length / 100
    : 0;

  const supplierCounts = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.supplier] = (acc[p.supplier] || 0) + 1;
    return acc;
  }, {});

  const statusActive = store.status === 'active';

  return (
    <div className="flex flex-1 flex-col gap-6">
      <AdminPageHeader
        eyebrow="Boutique"
        title={
          <span className="flex items-center gap-3">
            <StoreAvatar slug={store.slug} name={store.name} size={40} />
            <span className="min-w-0 truncate">{store.name}</span>
          </span>
        }
        description={store.tagline || undefined}
        actions={<StoreActions storeId={store.id} storeName={store.name} />}
      />

      <AdminStatGrid>
        <AdminStatCard label="Produits" value={products.length.toString()} />
        <AdminStatCard label="Prix moyen" value={`${avgPrice.toFixed(2)} €`} />
        <AdminStatCard label="Marge moy." value={`${margin.toFixed(2)} €`} />
        <AdminStatCard label="Statut" value={statusActive ? 'En ligne' : store.status} />
      </AdminStatGrid>

      <AdminCard>
        <AdminCardHeader
          title="Informations"
          eyebrow="Boutique"
          action={
            <AdminBadge color={statusActive ? 'green' : 'zinc'}>
              {statusActive ? 'En ligne' : store.status}
            </AdminBadge>
          }
        />
        <dl className="divide-y divide-white/10">
          <div className="px-5 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-400">Niche</dt>
            <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">{store.niche || '—'}</dd>
          </div>

          <div className="px-5 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-400">Fournisseurs</dt>
            <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
              {Object.entries(supplierCounts).map(([s, count]) => `${s} (${count})`).join(', ') || '—'}
            </dd>
          </div>

          {store.medusa_publishable_key && (
            <div className="px-5 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-400">Clé API</dt>
              <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                <code className="rounded bg-white/5 px-2 py-1 font-mono text-xs text-gray-400 ring-1 ring-white/10">
                  {store.medusa_publishable_key.slice(0, 24)}&hellip;
                </code>
              </dd>
            </div>
          )}

          {store.description && (
            <div className="px-5 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-400">Description</dt>
              <dd className="mt-1 text-sm text-gray-400 sm:col-span-2 sm:mt-0">{store.description}</dd>
            </div>
          )}

          <div className="px-5 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-400">Domaine</dt>
            <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">{store.custom_domain || '—'}</dd>
          </div>

          {store.error_message && !statusActive && (
            <div className="px-5 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-400">Erreur</dt>
              <dd className="mt-1 text-sm text-gray-400 sm:col-span-2 sm:mt-0">
                <span>{store.error_message}</span>
                <Link
                  href={`/admin/stores/new?niche=${encodeURIComponent(store.niche)}&name=${encodeURIComponent(store.name)}`}
                  className="ml-3 font-medium text-indigo-400 underline hover:text-indigo-300"
                >
                  Recr&eacute;er ce store
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </AdminCard>

      <AdminCard className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Catalogue</p>
          <p className="mt-1 text-sm text-gray-400">
            <span className="font-semibold tabular-nums text-white">{products.length}</span>{' '}
            produit{products.length > 1 ? 's' : ''} import&eacute;{products.length > 1 ? 's' : ''}.
          </p>
        </div>
        <Link
          href={`/admin/stores/${store.id}/catalog`}
          className="inline-flex shrink-0 items-center rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Voir le catalogue
        </Link>
      </AdminCard>
    </div>
  );
}
