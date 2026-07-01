/**
 * Wholesale2B — feed-only supplier client.
 * Products are ingested from their data feed and stored in the
 * `dropship_supplier_catalog` table (created by migration 033, a sibling
 * stream). searchProducts reads that table via getDbRead(); placeOrder is
 * intentionally absent (Wholesale2B orders are placed through their portal).
 *
 * env: W2B_API_KEY (used by ingestWholesale2bFeed only)
 *
 * // CONFIRM: feed URL and auth mechanism for Wholesale2B.
 *   Current assumption: REST feed at https://api.wholesale2b.com/products
 *   with Authorization: Bearer ${W2B_API_KEY}. Adjust ingestWholesale2bFeed()
 *   once the real feed endpoint and auth scheme are confirmed.
 */
import 'server-only';
import type { SupplierClient, SupplierSearchResult, SupplierSearchParams } from './types';
import { getDbRead } from '@/lib/db';

const W2B_API_KEY = (process.env.W2B_API_KEY || '').trim();
const SUPPLIER_ID = 'wholesale2b';

// ---------------------------------------------------------------------------
// Catalog reader (primary code path for searchProducts)
// ---------------------------------------------------------------------------

/**
 * Read from dropship_supplier_catalog (ingested feed data).
 * Guards gracefully if the table doesn't exist yet (migration 033 may not
 * have run, or the sibling stream hasn't landed).
 */
export async function searchWholesale2bProducts(
  params: SupplierSearchParams,
): Promise<SupplierSearchResult> {
  try {
    const db = getDbRead();
    const limit = Math.min(params.pageSize || 20, 100);
    const offset = ((params.page || 1) - 1) * limit;
    const keyword = `%${params.keywords.toLowerCase()}%`;

    const { rows } = await db.query<{
      external_id: string;
      title: string;
      price_eur: number;
      image_url: string;
      supplier_url: string;
      weight_grams: number | null;
      total: string;
    }>(
      `SELECT
         external_id,
         title,
         price_eur,
         image_url,
         supplier_url,
         weight_grams,
         COUNT(*) OVER() AS total
       FROM dropship_supplier_catalog
       WHERE supplier = $1
         AND lower(title) LIKE $2
       ORDER BY title
       LIMIT $3 OFFSET $4`,
      [SUPPLIER_ID, keyword, limit, offset],
    );

    const products = rows.map((r) => ({
      supplier: SUPPLIER_ID as 'wholesale2b',
      externalId: r.external_id,
      title: r.title,
      price: Number(r.price_eur),
      imageUrl: r.image_url,
      supplierUrl: r.supplier_url,
      weightGrams: r.weight_grams ?? undefined,
    }));

    return {
      success: true,
      products,
      total: rows[0] ? parseInt(rows[0].total, 10) : 0,
    };
  } catch (e) {
    const msg = (e as Error).message ?? '';
    // Guard: catalog table may not exist yet
    if (/relation.*dropship_supplier_catalog.*does not exist/i.test(msg) ||
        /dropship_supplier_catalog/i.test(msg)) {
      return {
        success: false,
        products: [],
        error: 'wholesale2b catalog not ingested',
      };
    }
    return {
      success: false,
      products: [],
      error: `wholesale2b DB error: ${msg}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Feed ingestor skeleton (called by a cron / background job)
// ---------------------------------------------------------------------------

interface W2BFeedProduct {
  sku: string;
  title: string;
  priceEur: number;
  imageUrl: string;
  productUrl: string;
  weightGrams?: number;
}

/**
 * Ingest the Wholesale2B product feed into dropship_supplier_catalog.
 * // CONFIRM: feed endpoint URL, auth scheme, pagination, and field mapping.
 *   Current shape is illustrative; adapt to real feed once confirmed.
 */
export async function ingestWholesale2bFeed(): Promise<{ ingested: number; error?: string }> {
  if (!W2B_API_KEY) {
    return { ingested: 0, error: 'W2B_API_KEY not configured' };
  }

  try {
    // // CONFIRM: real feed URL and pagination shape
    const res = await fetch('https://api.wholesale2b.com/products', {
      headers: {
        Authorization: `Bearer ${W2B_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      return { ingested: 0, error: `W2B feed HTTP ${res.status}` };
    }

    // // CONFIRM: response JSON shape
    const data = (await res.json()) as { products?: W2BFeedProduct[] };
    const products = data.products ?? [];

    if (products.length === 0) {
      return { ingested: 0 };
    }

    // Upsert into dropship_supplier_catalog
    // The table is created by migration 033 (sibling stream).
    // We guard: if table absent, we return an error rather than crashing.
    const { getDb } = await import('@/lib/db');
    const db = getDb();

    let ingested = 0;
    for (const p of products) {
      await db.query(
        `INSERT INTO dropship_supplier_catalog
           (supplier, external_id, title, price_eur, image_url, supplier_url, weight_grams, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (supplier, external_id) DO UPDATE SET
           title = EXCLUDED.title,
           price_eur = EXCLUDED.price_eur,
           image_url = EXCLUDED.image_url,
           supplier_url = EXCLUDED.supplier_url,
           weight_grams = EXCLUDED.weight_grams,
           updated_at = now()`,
        [
          SUPPLIER_ID,
          p.sku,
          p.title,
          p.priceEur,
          p.imageUrl,
          p.productUrl,
          p.weightGrams ?? null,
        ],
      );
      ingested++;
    }

    return { ingested };
  } catch (e) {
    return { ingested: 0, error: (e as Error).message ?? 'Unknown feed error' };
  }
}

// ---------------------------------------------------------------------------
// SupplierClient implementation
// ---------------------------------------------------------------------------

export const wholesale2bClient: SupplierClient = {
  id: SUPPLIER_ID,
  label: 'Wholesale2B',
  tier: 'v2',
  status: 'feed-only',
  capabilities: {
    unitOrder: true,
    noStock: true,
    directShip: true,
    neutralPackaging: true,
    stockPriceSync: true,
    tracking: true,
    returns: true,
    imageRights: true,
  },
  // placeOrder intentionally absent — feed-only
  async searchProducts(params: SupplierSearchParams): Promise<SupplierSearchResult> {
    return searchWholesale2bProducts(params);
  },
};
