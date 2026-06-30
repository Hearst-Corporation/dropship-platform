import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatGrid, AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminCard, AdminCardHeader } from '@/components/admin/AdminCard';
import { AdminBadge } from '@/components/admin/AdminBadge';

export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string;
  supplier: string;
  external_id: string;
  supplier_url: string | null;
  enriched_title: string;
  enriched_description: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  medusa_product_id: string | null;
  image_quality_score: string | null; // numeric(3,2) comes back as string
  created_at: string;
}

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  logo_emoji: string;
  niche: string;
}

export default async function StoreCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  const storeRes = await db.query<StoreRow>(
    `SELECT id, slug, name, logo_emoji, niche FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const { rows: products } = await db.query<ProductRow>(
    `SELECT id, supplier, external_id, supplier_url, enriched_title, enriched_description,
            price_cents, cost_cents, image_url, medusa_product_id,
            image_quality_score, created_at
       FROM dropship_store_products
      WHERE store_id = $1
      ORDER BY created_at ASC
      LIMIT 500`,
    [storeId],
  );

  const totalRetailCents = products.reduce((s, p) => s + p.price_cents, 0);
  const totalCostCents = products.reduce((s, p) => s + p.cost_cents, 0);
  const totalMarginCents = totalRetailCents - totalCostCents;
  const avgMargin = products.length > 0 ? totalMarginCents / products.length / 100 : 0;
  const avgPrice = products.length > 0 ? totalRetailCents / products.length / 100 : 0;

  const supplierCounts = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.supplier] = (acc[p.supplier] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-1 flex-col gap-6">
      <AdminPageHeader
        eyebrow="Catalogue"
        title={
          <span>
            Produits <em className="font-normal italic text-gray-400">du store</em>
          </span>
        }
        description={`Niche · ${store.niche} · Géré par l'agent à la création, modifiable via Curation.`}
        actions={
          <Link
            href={`/admin/stores/${id}/copilot`}
            className="rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
          >
            Discuter avec le copilote
          </Link>
        }
      />

      <AdminStatGrid>
        <AdminStatCard label="Produits" value={products.length.toString()} />
        <AdminStatCard label="Prix moyen" value={`${avgPrice.toFixed(2)} €`} />
        <AdminStatCard label="Marge moy." value={`${avgMargin.toFixed(2)} €`} />
        <AdminStatCard label="Fournisseurs" value={Object.keys(supplierCounts).length.toString()} />
      </AdminStatGrid>

      <AdminCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AdminCardHeader
          title={`${products.length} produit${products.length > 1 ? 's' : ''}`}
          action={
            Object.entries(supplierCounts).length > 0 ? (
              <span className="text-xs text-gray-500">
                {Object.entries(supplierCounts)
                  .map(([s, c]) => `${s}·${c}`)
                  .join(' / ')}
              </span>
            ) : undefined
          }
        />

        {products.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <p className="max-w-sm text-sm text-gray-500">
              Aucun produit dans ce store. Lance le copilote de curation pour en importer.
            </p>
            <Link
              href={`/admin/stores/${id}/copilot`}
              className="inline-flex items-center rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Ajouter des produits
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead>
                <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th scope="col" className="px-5 py-3 text-left">
                    Produit
                  </th>
                  <th scope="col" className="px-3 py-3 text-left">
                    Source
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Coût
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Prix
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Marge
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Image
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    État
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {products.map((p) => {
                  const margin = (p.price_cents - p.cost_cents) / 100;
                  const marginPct =
                    p.cost_cents > 0
                      ? Math.round(((p.price_cents - p.cost_cents) / p.cost_cents) * 100)
                      : 0;
                  const supplierColor = p.supplier === 'ai-generated' ? 'zinc' : 'green';
                  return (
                    <tr key={p.id}>
                      <td className="px-5 py-3 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="flex size-full items-center justify-center text-lg">
                                {store.logo_emoji}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="max-w-[28ch] truncate font-medium text-white">
                              {p.enriched_title}
                            </div>
                            <div className="mt-0.5 max-w-[36ch] truncate text-xs text-gray-500">
                              {p.enriched_description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <AdminBadge color={supplierColor}>{p.supplier}</AdminBadge>
                      </td>
                      <td className="px-3 py-3 text-right align-middle tabular-nums text-gray-400">
                        {(p.cost_cents / 100).toFixed(2)} €
                      </td>
                      <td className="px-3 py-3 text-right align-middle font-medium tabular-nums text-white">
                        {(p.price_cents / 100).toFixed(2)} €
                      </td>
                      <td className="px-3 py-3 text-right align-middle tabular-nums">
                        <span className="font-medium text-indigo-400">+{margin.toFixed(2)} €</span>
                        <span className="block text-xs text-gray-500">{marginPct}%</span>
                      </td>
                      <td className="px-3 py-3 text-right align-middle tabular-nums text-gray-400">
                        {p.image_quality_score != null
                          ? `${Math.round(parseFloat(p.image_quality_score) * 100)}%`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right align-middle">
                        {p.medusa_product_id ? (
                          <AdminBadge color="green">Live</AdminBadge>
                        ) : (
                          <AdminBadge color="zinc">En attente</AdminBadge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
