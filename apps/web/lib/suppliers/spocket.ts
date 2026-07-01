/**
 * Spocket catalog API client — search-only, no headless order API.
 *
 * Spocket fulfillment is MANUAL: merchants place orders via the Spocket
 * dashboard and paste tracking numbers back. There is no public order-creation
 * endpoint supported here.
 *
 * Env:
 *   SUPPLIER_SPOCKET_API_KEY — Spocket API key (catalog access).
 *     Absent → searchProducts returns an unavailable error immediately.
 *
 * // CONFIRM: Spocket does not publish a stable public REST catalog API.
 * // The base URL and auth header below are based on the Spocket developer
 * // docs draft (https://developers.spocket.co — as of 2026-07). Verify the
 * // exact base URL, the auth header name, and the search endpoint path when
 * // integrating. The response shape (products[].id, .title, .price, .images,
 * // .url) is provisional and must be reconciled against the real docs.
 */

import type { SupplierClient, SupplierSearchResult, SupplierSearchParams } from './types';
import { usdToEur } from './fx';

// // CONFIRM: base URL — Spocket's catalog REST endpoint.
const SPOCKET_API_BASE = 'https://app.spocket.co/api';

const SPOCKET_API_KEY = () => (process.env.SUPPLIER_SPOCKET_API_KEY || '').trim();

interface SpocketProduct {
  id: string;
  title: string;
  // // CONFIRM: price field — may be `original_price`, `retail_price`, or `variants[0].price` (USD or EUR).
  price: number;
  // // CONFIRM: image field name — may be `thumbnail_url`, `images[0].src`, or similar.
  thumbnail_url: string;
  // // CONFIRM: product URL field name.
  url: string;
  weight?: number; // grams — // CONFIRM field name
}

interface SpocketSearchResponse {
  // // CONFIRM: top-level shape — Spocket may wrap in `data` or return `products` directly.
  products: SpocketProduct[];
  total_count?: number;
}

/**
 * Call the Spocket catalog search endpoint.
 * // CONFIRM: endpoint path, query-param names, pagination shape, auth header.
 */
async function callSpocketSearch(params: SupplierSearchParams): Promise<SpocketSearchResponse> {
  const key = SPOCKET_API_KEY();
  if (!key) throw new Error('SUPPLIER_SPOCKET_API_KEY not set');

  const qs = new URLSearchParams({
    // // CONFIRM: Spocket may use `q`, `search`, or `keywords`.
    q: params.keywords,
    page: String(params.page ?? 1),
    per_page: String(Math.min(params.pageSize ?? 20, 50)),
  });

  const res = await fetch(`${SPOCKET_API_BASE}/v1/products/search?${qs}`, {
    headers: {
      // // CONFIRM: Spocket auth header name — may be `Authorization: Bearer …` or `X-Spocket-Access-Token: …`.
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Spocket HTTP ${res.status}`);

  const data = await res.json() as SpocketSearchResponse;
  return data;
}

// ---------------------------------------------------------------------------
// SupplierClient implementation
// ---------------------------------------------------------------------------

export const spocketClient: SupplierClient = {
  id: 'spocket',
  label: 'Spocket',
  tier: 'v1',
  // search_only: catalog browsing only; placeOrder is manual via dashboard.
  status: 'search_only',
  capabilities: {
    unitOrder: true,          // single-unit orders placed manually on dashboard
    noStock: true,            // supplier ships after customer sale
    directShip: true,         // ships directly to end customer
    neutralPackaging: false,  // // CONFIRM: Spocket branding depends on supplier
    stockPriceSync: true,     // Spocket syncs stock/price in catalog
    tracking: false,          // tracking requires manual input from dashboard
    returns: false,           // no automated returns flow
    imageRights: false,       // product imagery rights not guaranteed
  },

  // placeOrder intentionally absent — Spocket fulfillment is manual.

  async searchProducts(params: SupplierSearchParams): Promise<SupplierSearchResult> {
    const key = SPOCKET_API_KEY();
    if (!key) {
      return {
        success: false,
        products: [],
        error: 'Spocket catalog API unavailable — catalog-only, manual fulfillment',
      };
    }

    try {
      const data = await callSpocketSearch(params);
      const products = (data.products ?? []).map((p) => ({
        supplier: 'spocket' as const,
        externalId: String(p.id),
        title: p.title,
        // // CONFIRM currency: Spocket stores prices in USD by default; converting USD→EUR.
        price: usdToEur(p.price),
        imageUrl: p.thumbnail_url ?? '',
        supplierUrl: p.url ?? '',
        weightGrams: p.weight ?? undefined,
      }));
      return {
        success: true,
        products,
        total: data.total_count ?? products.length,
      };
    } catch (e) {
      return {
        success: false,
        products: [],
        error: e instanceof Error ? e.message : 'Spocket search error',
      };
    }
  },
};
