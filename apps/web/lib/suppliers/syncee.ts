/**
 * Syncee feed + catalog client — feed-only, no headless order API.
 *
 * Syncee operates in two modes:
 *   1. Marketplace API (SUPPLIER_SYNCEE_API_KEY): search the Syncee product
 *      catalog via REST and ingest matching rows.
 *   2. Feed URL (SUPPLIER_SYNCEE_FEED_URL): fetch a pre-built product export
 *      (CSV/JSON) from a Syncee-hosted feed URL.
 *
 * Only products that pass `isDropshipDirect` are stored — wholesale rows,
 * MOQ > 1, and non-direct-shipping listings are silently dropped.
 *
 * After ingest, `searchProducts` queries the local `dropship_supplier_catalog`
 * table (applied by migration 033_supplier_catalog.sql).
 *
 * Env:
 *   SUPPLIER_SYNCEE_API_KEY  — Syncee marketplace REST API key.
 *   SUPPLIER_SYNCEE_FEED_URL — Syncee-hosted feed URL (CSV or JSON).
 *   At least one of the two must be set for ingest to work.
 *
 * // CONFIRM: Syncee's public marketplace API base URL and auth scheme.
 * // The endpoint paths, query parameters, and response field names below are
 * // based on Syncee's published integration docs (https://syncee.com/api-docs)
 * // and are provisional. Verify the exact field names before going live:
 * //   - `shipping_type` or `fulfillment_type` for direct vs wholesale
 * //   - `supplier_type` for detecting dropship vs wholesale suppliers
 * //   - `minimum_order_quantity` or `moq` for MOQ gate
 * //   - `unit_price` vs `price` for per-unit pricing
 */

import type { SupplierClient, SupplierSearchResult, SupplierSearchParams } from './types';
import { getDb, getDbRead } from '@/lib/db';

// // CONFIRM: Syncee marketplace API base URL.
const SYNCEE_API_BASE = 'https://api.syncee.com/v1';

const SYNCEE_API_KEY = () => (process.env.SUPPLIER_SYNCEE_API_KEY || '').trim();
const SYNCEE_FEED_URL = () => (process.env.SUPPLIER_SYNCEE_FEED_URL || '').trim();

// ---------------------------------------------------------------------------
// Syncee raw product shape (API or feed)
// ---------------------------------------------------------------------------

interface SynceeRawProduct {
  id: string;
  title: string;
  // // CONFIRM: price field — Syncee may use `price`, `unit_price`, or `variants[0].price` (EUR).
  price: number;
  // // CONFIRM: image field name.
  image_url: string;
  // // CONFIRM: product URL field name.
  product_url: string;
  weight_grams?: number;

  // Direct-ship filter fields — // CONFIRM exact field names:
  // // CONFIRM: shipping_type values: 'dropship' | 'wholesale' | 'direct' | … ?
  shipping_type?: string;
  // // CONFIRM: supplier_type values: 'dropship' | 'wholesale' | … ?
  supplier_type?: string;
  // // CONFIRM: MOQ field name — may be `minimum_order_quantity`, `moq`, or `min_qty`.
  minimum_order_quantity?: number;
  // // CONFIRM: whether a per-unit price is distinct from a bulk price. Some
  // feeds encode `unit_price` separately.
  unit_price?: number;
}

interface SynceeApiResponse {
  // // CONFIRM: Syncee API wraps results in `data` or `products`.
  products?: SynceeRawProduct[];
  data?: SynceeRawProduct[];
  total?: number;
}

// ---------------------------------------------------------------------------
// isDropshipDirect — pure filter, exported for testing
// ---------------------------------------------------------------------------

/**
 * Returns true only for genuine per-unit dropshipping products.
 *
 * Excluded:
 *   - Wholesale supplier type
 *   - MOQ > 1 (requires buying multiple units)
 *   - Missing per-unit price (bulk-only pricing)
 *
 * // CONFIRM: the exact field names and values used by Syncee to distinguish
 * // dropship-direct from wholesale. This function must be updated once the
 * // real feed has been inspected.
 */
export function isDropshipDirect(p: SynceeRawProduct): boolean {
  // Reject wholesale supplier types
  if (p.supplier_type && /wholesale/i.test(p.supplier_type)) return false;

  // // CONFIRM: Syncee uses 'dropship' or similar for direct fulfillment.
  // If shipping_type is explicitly set and NOT dropship/direct, reject.
  if (p.shipping_type && !/dropship|direct/i.test(p.shipping_type)) return false;

  // Reject MOQ > 1 (no single-unit ordering)
  const moq = p.minimum_order_quantity ?? 1;
  if (moq > 1) return false;

  // Require a per-unit price (either unit_price or price must be > 0)
  const effectivePrice = p.unit_price ?? p.price ?? 0;
  if (effectivePrice <= 0) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Feed / API fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetch products from the Syncee marketplace REST API.
 * // CONFIRM: endpoint path, auth header, pagination params, response shape.
 */
async function fetchFromApi(page = 1, pageSize = 100): Promise<SynceeRawProduct[]> {
  const key = SYNCEE_API_KEY();
  if (!key) return [];

  const qs = new URLSearchParams({
    // // CONFIRM: Syncee API query params for pagination.
    page: String(page),
    per_page: String(pageSize),
  });

  const res = await fetch(`${SYNCEE_API_BASE}/products?${qs}`, {
    headers: {
      // // CONFIRM: Syncee API auth header — may be `Authorization: Bearer …`,
      // `X-Api-Key: …`, or similar.
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Syncee API HTTP ${res.status}`);
  const data = await res.json() as SynceeApiResponse;
  return data.products ?? data.data ?? [];
}

/**
 * Fetch products from a Syncee-hosted feed URL (CSV or JSON).
 * // CONFIRM: Syncee feed format — JSON assumed here; CSV would need parsing.
 */
async function fetchFromFeedUrl(feedUrl: string): Promise<SynceeRawProduct[]> {
  const res = await fetch(feedUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Syncee feed HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    const data = await res.json() as SynceeApiResponse | SynceeRawProduct[];
    if (Array.isArray(data)) return data;
    return (data as SynceeApiResponse).products ?? (data as SynceeApiResponse).data ?? [];
  }

  // // CONFIRM: if Syncee provides CSV, implement CSV parsing here.
  throw new Error('Syncee feed returned non-JSON content-type; CSV parsing not yet implemented. // CONFIRM feed format.');
}

// ---------------------------------------------------------------------------
// ingestSynceeFeed — exported for cron / admin trigger
// ---------------------------------------------------------------------------

/**
 * Fetch the Syncee catalog (API or feed URL), filter to dropship-direct rows,
 * and UPSERT into `dropship_supplier_catalog`.
 *
 * Skips gracefully if neither API key nor feed URL is configured.
 * Returns the count of upserted rows.
 */
export async function ingestSynceeFeed(): Promise<{ upserted: number; skipped: number; error?: string }> {
  const apiKey = SYNCEE_API_KEY();
  const feedUrl = SYNCEE_FEED_URL();

  if (!apiKey && !feedUrl) {
    return { upserted: 0, skipped: 0, error: 'Neither SUPPLIER_SYNCEE_API_KEY nor SUPPLIER_SYNCEE_FEED_URL is configured' };
  }

  let rawProducts: SynceeRawProduct[] = [];

  try {
    if (feedUrl) {
      rawProducts = await fetchFromFeedUrl(feedUrl);
    } else {
      // Page through the API — fetch up to 10 pages of 100 for a reasonable cap.
      // // CONFIRM: Syncee API pagination limits and whether a `total` field is available.
      for (let page = 1; page <= 10; page++) {
        const batch = await fetchFromApi(page, 100);
        rawProducts.push(...batch);
        if (batch.length < 100) break; // last page
      }
    }
  } catch (e) {
    return {
      upserted: 0,
      skipped: 0,
      error: e instanceof Error ? e.message : 'Syncee feed fetch error',
    };
  }

  const direct = rawProducts.filter(isDropshipDirect);
  const dropped = rawProducts.length - direct.length;

  if (direct.length === 0) {
    return { upserted: 0, skipped: dropped };
  }

  try {
    const db = getDb();

    // Batch UPSERT — chunk into groups of 500 to avoid excessively large statements.
    const CHUNK = 500;
    let upserted = 0;

    for (let i = 0; i < direct.length; i += CHUNK) {
      const chunk = direct.slice(i, i + CHUNK);

      // Build parameterised VALUES list.
      const placeholders: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const p of chunk) {
        const effectivePrice = p.unit_price ?? p.price ?? 0;
        placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, now())`);
        values.push(
          'syncee',
          String(p.id),
          p.title,
          effectivePrice,
          p.image_url ?? null,
          p.product_url ?? null,
          true, // is_dropship_direct — all rows passed isDropshipDirect()
          JSON.stringify(p), // raw JSONB
        );
      }

      const sql = `
        INSERT INTO public.dropship_supplier_catalog
          (supplier, external_id, title, price_eur, image_url, supplier_url, is_dropship_direct, raw, synced_at)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (supplier, external_id)
        DO UPDATE SET
          title              = EXCLUDED.title,
          price_eur          = EXCLUDED.price_eur,
          image_url          = EXCLUDED.image_url,
          supplier_url       = EXCLUDED.supplier_url,
          is_dropship_direct = EXCLUDED.is_dropship_direct,
          raw                = EXCLUDED.raw,
          synced_at          = EXCLUDED.synced_at
      `;

      await db.query(sql, values);
      upserted += chunk.length;
    }

    return { upserted, skipped: dropped };
  } catch (e) {
    return {
      upserted: 0,
      skipped: dropped,
      error: e instanceof Error ? e.message : 'Syncee DB upsert error',
    };
  }
}

// ---------------------------------------------------------------------------
// SupplierClient implementation
// ---------------------------------------------------------------------------

export const synceeClient: SupplierClient = {
  id: 'syncee',
  label: 'Syncee',
  tier: 'v1',
  status: 'feed-only',
  capabilities: {
    unitOrder: true,         // single-unit orders (after ingest, fulfilled by supplier)
    noStock: true,           // no pre-purchase of stock required
    directShip: true,        // suppliers ship directly to end customer
    neutralPackaging: false, // // CONFIRM: Syncee supplier packaging varies
    stockPriceSync: true,    // Syncee provides feed-based stock + price sync
    tracking: false,         // no automated tracking via this integration
    returns: false,          // no automated returns flow
    imageRights: false,      // image rights depend on individual supplier
  },

  // placeOrder intentionally absent — feed-only integration.

  async searchProducts(params: SupplierSearchParams): Promise<SupplierSearchResult> {
    try {
      const db = getDbRead();

      // Full-text search via ILIKE for simplicity; the GIN index on
      // to_tsvector('simple', title) can be leveraged by adding a tsvector
      // predicate if performance becomes a concern.
      const keywords = (params.keywords ?? '').trim();
      const likePattern = `%${keywords.replace(/[%_]/g, '\\$&')}%`;
      const pageSize = Math.min(params.pageSize ?? 20, 100);
      const offset = ((params.page ?? 1) - 1) * pageSize;

      type CatalogRow = {
        external_id: string;
        title: string;
        price_eur: string;
        image_url: string | null;
        supplier_url: string | null;
      };

      const result = await db.query<CatalogRow>(
        `SELECT external_id, title, price_eur, image_url, supplier_url
         FROM public.dropship_supplier_catalog
         WHERE supplier = 'syncee'
           AND is_dropship_direct = true
           AND title ILIKE $1
         ORDER BY synced_at DESC
         LIMIT $2 OFFSET $3`,
        [likePattern, pageSize, offset],
      );

      const products = result.rows.map((row) => ({
        supplier: 'syncee' as const,
        externalId: row.external_id,
        title: row.title,
        price: parseFloat(row.price_eur),
        imageUrl: row.image_url ?? '',
        supplierUrl: row.supplier_url ?? '',
      }));

      return { success: true, products };
    } catch (e) {
      // Guard: table may be absent in staging environments where the migration
      // has not yet been applied.
      const msg = e instanceof Error ? e.message : 'Syncee catalog query error';
      return { success: false, products: [], error: msg };
    }
  },
};
