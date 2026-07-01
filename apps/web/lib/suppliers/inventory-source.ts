/**
 * Inventory Source — aggregation middleware, feed-only supplier client.
 * Products are ingested from the IS feed into `dropship_supplier_catalog`
 * (migration 033, sibling stream). searchProducts reads that table.
 * placeOrder is intentionally absent — orders are routed through IS portal
 * or their direct supplier connections.
 *
 * // CONFIRM: imageRights — Inventory Source aggregates many suppliers; image
 *   licensing varies per underlying supplier. capabilities.imageRights is set
 *   to false (conservative) pending clarification.
 *
 * // CONFIRM: feed URL and auth mechanism for Inventory Source.
 *   Current assumption: REST feed at https://api.inventorysource.com/products
 *   with Authorization: Bearer ${INVENTORY_SOURCE_API_KEY}. Adjust
 *   ingestInventorySourceFeed() once confirmed.
 *
 * env: INVENTORY_SOURCE_API_KEY
 */
import 'server-only';
import type { SupplierClient, SupplierSearchResult, SupplierSearchParams } from './types';
import { getDbRead } from '@/lib/db';

const IS_API_KEY = (process.env.INVENTORY_SOURCE_API_KEY || '').trim();
const SUPPLIER_ID = 'inventory-source';

// ---------------------------------------------------------------------------
// Catalog reader
// ---------------------------------------------------------------------------

/**
 * Read from dropship_supplier_catalog (ingested feed data).
 * Guards gracefully if the table doesn't exist yet.
 */
export async function searchInventorySourceProducts(
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
      supplier: SUPPLIER_ID as 'inventory-source',
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
    // Guard: catalog table may not exist yet (migration 033 pending)
    if (/relation.*dropship_supplier_catalog.*does not exist/i.test(msg) ||
        /dropship_supplier_catalog/i.test(msg)) {
      return {
        success: false,
        products: [],
        error: 'inventory-source catalog not ingested',
      };
    }
    return {
      success: false,
      products: [],
      error: `inventory-source DB error: ${msg}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Feed ingestor skeleton
// ---------------------------------------------------------------------------

interface ISFeedProduct {
  sku: string;
  title: string;
  priceEur: number;
  imageUrl: string;
  productUrl: string;
  weightGrams?: number;
}

/**
 * Ingest the Inventory Source product feed into dropship_supplier_catalog.
 * // CONFIRM: feed endpoint URL, auth scheme, pagination, and field mapping.
 */
export async function ingestInventorySourceFeed(): Promise<{ ingested: number; error?: string }> {
  if (!IS_API_KEY) {
    return { ingested: 0, error: 'INVENTORY_SOURCE_API_KEY not configured' };
  }

  try {
    // // CONFIRM: real feed URL, auth header, and pagination
    const res = await fetch('https://api.inventorysource.com/products', {
      headers: {
        Authorization: `Bearer ${IS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      return { ingested: 0, error: `IS feed HTTP ${res.status}` };
    }

    // // CONFIRM: response JSON shape
    const data = (await res.json()) as { products?: ISFeedProduct[] };
    const products = data.products ?? [];

    if (products.length === 0) {
      return { ingested: 0 };
    }

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
    return { ingested: 0, error: (e as Error).message ?? 'Unknown IS feed error' };
  }
}

// ---------------------------------------------------------------------------
// SupplierClient implementation
// ---------------------------------------------------------------------------

export const inventorySourceClient: SupplierClient = {
  id: SUPPLIER_ID,
  label: 'Inventory Source',
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
    imageRights: false, // // CONFIRM — varies per underlying supplier
  },
  // placeOrder intentionally absent — feed-only
  async searchProducts(params: SupplierSearchParams): Promise<SupplierSearchResult> {
    return searchInventorySourceProducts(params);
  },
};
