/**
 * Storefront data loader — reads a store and its products straight from the
 * (GPU1) Postgres, with NO Medusa dependency. This is what lets a
 * FACTORY_LOCAL_ONLY store — which has no Medusa sales channel — render a full
 * storefront: everything the page needs lives in `dropship_stores` +
 * `dropship_store_products`.
 */
import { getDbRead } from '@/lib/db';
import { getStoreBySlug, getStoreBySlugAdmin, type StoreConfig } from '@/lib/store-config';

export interface FactoryProduct {
  /** Stable handle for /shop/{slug}/products/{handle} (external supplier id). */
  handle: string;
  title: string;
  description: string;
  priceCents: number;
  costCents: number;
  imageUrl: string | null;
  supplier: string;
  supplierUrl: string | null;
}

export interface FactoryStore {
  store: StoreConfig;
  products: FactoryProduct[];
  /** Primary product for mono templates (highest-priced / first). */
  hero: FactoryProduct | null;
}

interface ProductRow {
  supplier: string;
  external_id: string;
  enriched_title: string | null;
  original_title: string | null;
  enriched_description: string | null;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  supplier_url: string | null;
}

async function loadProducts(storeId: string): Promise<FactoryProduct[]> {
  const db = getDbRead();
  const { rows } = await db.query<ProductRow>(
    `SELECT supplier, external_id, enriched_title, original_title, enriched_description,
            price_cents, cost_cents, image_url, supplier_url
       FROM dropship_store_products
      WHERE store_id = $1
      ORDER BY price_cents DESC`,
    [storeId],
  );
  return rows.map((r) => ({
    handle: r.external_id,
    title: r.enriched_title || r.original_title || 'Produit',
    description: r.enriched_description || '',
    priceCents: r.price_cents,
    costCents: r.cost_cents,
    imageUrl: r.image_url,
    supplier: r.supplier,
    supplierUrl: r.supplier_url,
  }));
}

/**
 * Load a store for the public storefront (published only) or, when
 * `preview` is set, any status (admin/preview of a factory store that isn't
 * published yet). Returns null when the store doesn't exist / isn't visible.
 */
export async function loadFactoryStore(
  slug: string,
  opts: { preview?: boolean } = {},
): Promise<FactoryStore | null> {
  const store = opts.preview ? await getStoreBySlugAdmin(slug) : await getStoreBySlug(slug);
  if (!store) return null;
  const products = await loadProducts(store.id);
  return { store, products, hero: products[0] ?? null };
}
