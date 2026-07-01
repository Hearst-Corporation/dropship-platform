/**
 * Doba Retailer API client — feed-only (search only; order placement pending
 * signature + pay-after-sale confirmation).
 *
 * Docs: https://open.doba.com
 * Auth: HMAC-SHA256 signed headers (shape mirrored from aliexpress.ts IOP
 *       signing), using DOBA_ACCESS_KEY + DOBA_SECRET.
 *
 * // CONFIRM: Doba signature algorithm details.
 *   Current assumption: HMAC-SHA256(DOBA_SECRET, path + sorted(k+v)), hex
 *   uppercase — same shape as AliExpress IOP /rest. If Doba uses a different
 *   scheme (query-string sign, x-doba-sign header, etc.) update signDoba().
 *
 * // CONFIRM: product search endpoint path and response shape.
 *   Current assumption: POST https://open.doba.com/api/product/search
 *   with JSON body {keyword, page, pageSize}. Adjust searchDobaProducts().
 *
 * // CONFIRM: noStock (wallet/prepay) — Doba historically uses a wallet model
 *   where the retailer funds orders upfront, not strictly pay-after-sale.
 *   capabilities.noStock is set to true pending clarification.
 *
 * // CONFIRM: neutralPackaging — Doba ships under retailer brand in most
 *   plans but this varies by supplier; set to false (conservative) for now.
 *
 * placeOrder is intentionally absent until signature + pay-after-sale are
 * verified. When ready, uncomment the placeDobaOrder skeleton below.
 *
 * env: DOBA_ACCESS_KEY, DOBA_SECRET
 */
import 'server-only';
import { createHmac } from 'crypto';
import type { SupplierClient, SupplierSearchResult, SupplierSearchParams } from './types';

const DOBA_ACCESS_KEY = (process.env.DOBA_ACCESS_KEY || '').trim();
const DOBA_SECRET = (process.env.DOBA_SECRET || '').trim();
const API_BASE = 'https://open.doba.com';
const TIMEOUT_MS = 15_000;
const SUPPLIER_ID = 'doba';

// ---------------------------------------------------------------------------
// Signing helper
// ---------------------------------------------------------------------------

/**
 * HMAC-SHA256 signature for Doba API calls.
 * // CONFIRM: exact signing formula and header name(s).
 *   Shape mirrors aliexpress.ts signSystem() (IOP scheme):
 *     HMAC-SHA256(secret, apiPath + sorted(k+v)), hex uppercase.
 */
function signDoba(apiPath: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join('');
  return createHmac('sha256', DOBA_SECRET)
    .update(`${apiPath}${sorted}`, 'utf8')
    .digest('hex')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Internal API types  (// CONFIRM field names against real Doba docs)
// ---------------------------------------------------------------------------

interface DobaProduct {
  productId: string;      // // CONFIRM field name
  name: string;           // // CONFIRM field name
  imageUrl: string;       // // CONFIRM field name
  price: number;          // EUR // CONFIRM currency + field name
  productUrl?: string;    // // CONFIRM field name
  weightGrams?: number;   // // CONFIRM field name
}

interface DobaSearchResponse {
  code: number;           // 0 = success // CONFIRM
  message?: string;
  data?: {
    total?: number;
    products?: DobaProduct[];
  };
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Search Doba product catalog.
 * // CONFIRM: endpoint path, HTTP method, request body shape, response shape.
 */
export async function searchDobaProducts(
  params: SupplierSearchParams,
): Promise<SupplierSearchResult> {
  if (!DOBA_ACCESS_KEY || !DOBA_SECRET) {
    return {
      success: false,
      products: [],
      error: 'Doba credentials not configured (DOBA_ACCESS_KEY, DOBA_SECRET)',
      needsAuth: true,
    };
  }

  try {
    const apiPath = '/api/product/search'; // // CONFIRM
    const timestamp = Date.now().toString();
    const signParams: Record<string, string> = {
      access_key: DOBA_ACCESS_KEY,
      timestamp,
    };
    signParams.sign = signDoba(apiPath, signParams);

    const body = {
      keyword: params.keywords,
      page: params.page || 1,
      pageSize: Math.min(params.pageSize || 20, 100),
    };

    const res = await fetch(`${API_BASE}${apiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Doba-Access-Key': DOBA_ACCESS_KEY,   // // CONFIRM header names
        'X-Doba-Timestamp': timestamp,
        'X-Doba-Sign': signParams.sign,
        'User-Agent': 'hearstai-dropship/1.0',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        products: [],
        error: `Doba auth error HTTP ${res.status}`,
        needsAuth: true,
      };
    }
    if (!res.ok) {
      return {
        success: false,
        products: [],
        error: `Doba HTTP ${res.status}`,
      };
    }

    const data: DobaSearchResponse = await res.json();

    if (data.code !== 0) { // // CONFIRM success code
      return {
        success: false,
        products: [],
        error: `Doba error: ${data.message ?? data.code}`,
      };
    }

    const rawProducts = data.data?.products ?? [];
    const products = rawProducts.map((p) => ({
      supplier: SUPPLIER_ID as 'doba',
      externalId: String(p.productId),
      title: p.name,
      price: typeof p.price === 'string' ? parseFloat(p.price) : (p.price ?? 0),
      imageUrl: p.imageUrl ?? '',
      supplierUrl: p.productUrl ?? `https://www.doba.com/item/${p.productId}`,
      weightGrams: p.weightGrams ?? undefined,
    }));

    return {
      success: true,
      products,
      total: data.data?.total ?? products.length,
    };
  } catch (e) {
    return {
      success: false,
      products: [],
      error: (e as Error).message ?? 'Unknown Doba error',
    };
  }
}

/*
 * placeDobaOrder — NOT YET ENABLED.
 * Uncomment and wire into dobaClient once:
 *   1. The exact signing scheme is confirmed (// CONFIRM above).
 *   2. Pay-after-sale / wallet prepay model is resolved.
 *
 * import type { PlaceOrderInput, PlaceOrderResult } from './types';
 * export async function placeDobaOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> { ... }
 */

// ---------------------------------------------------------------------------
// SupplierClient implementation
// ---------------------------------------------------------------------------

export const dobaClient: SupplierClient = {
  id: SUPPLIER_ID,
  label: 'Doba',
  tier: 'v2',
  // feed-only until order flow confirmed
  status: 'feed-only',
  capabilities: {
    unitOrder: true,
    noStock: true,        // // CONFIRM wallet/prepay vs. pay-after-sale
    directShip: true,
    neutralPackaging: false, // // CONFIRM — conservative default
    stockPriceSync: true,
    tracking: true,
    returns: true,
    imageRights: true,
  },
  // placeOrder intentionally absent until confirmed
  async searchProducts(params: SupplierSearchParams): Promise<SupplierSearchResult> {
    return searchDobaProducts(params);
  },
};
