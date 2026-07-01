/**
 * BigBuy API client — V2 order API
 * Docs: https://api.bigbuy.eu/rest/doc
 *
 * Auth: static Bearer token (BIGBUY_API_KEY).
 * Tier: v2 / status: active (full capabilities — can place orders).
 *
 * // CONFIRM: price field name on /rest/catalog/products.json
 *   Current assumption: wholesalePrice (EUR, major units). If the real field
 *   differs (e.g. "retailPrice", "taxIncludedPrice"), update mapProduct().
 * // CONFIRM: carrier selection endpoint path and payload shape.
 *   Current assumption: GET /rest/order/carriers/new.json with no special
 *   query params returns a list [{id, ...}]; we pick the first available one.
 * // CONFIRM: tracking endpoint path.
 *   Current assumption: GET /rest/tracking/order/{supplierOrderId}.json
 *   returns {trackingNumber, carrier, status, ...}.
 */
import 'server-only';
import type {
  SupplierClient,
  SupplierSearchResult,
  PlaceOrderInput,
  PlaceOrderResult,
  TrackingResult,
} from './types';

const BB_API_KEY = (process.env.BIGBUY_API_KEY || '').trim();
const API_BASE = 'https://api.bigbuy.eu';
const TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Internal API types
// ---------------------------------------------------------------------------

interface BBProductInfo {
  id: number;
  sku: string;
  name: string;
  description?: string;
  weight?: number;          // grams? // CONFIRM unit
  // price field name unconfirmed — listed common candidates:
  wholesalePrice?: number;  // // CONFIRM
  retailPrice?: number;     // // CONFIRM (fallback)
  taxIncludedPrice?: number;// // CONFIRM (fallback)
}

interface BBProductImage {
  id: number;
  url: string;
  position?: number;
}

interface BBCarrier {
  id: number;
  name: string;
  shippingCost?: number;
}

// ---------------------------------------------------------------------------
// Auth header helper
// ---------------------------------------------------------------------------

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${BB_API_KEY}`,
    'Content-Type': 'application/json',
    'User-Agent': 'hearstai-dropship/1.0',
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function bbFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  if (!BB_API_KEY) throw new Error('BIGBUY_API_KEY not configured');
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts?.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401) {
    const err = new Error(`BigBuy HTTP 401 — check BIGBUY_API_KEY`);
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`BigBuy HTTP ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Extract a price from a BBProductInfo record (EUR, major units).
 * Returns null when no price field resolves to a positive number.
 * // CONFIRM: real field name (wholesalePrice vs retailPrice vs taxIncludedPrice).
 */
function extractPrice(info: BBProductInfo): number | null {
  // Try known field names in priority order — update when CONFIRMED.
  const raw =
    info.wholesalePrice ??
    info.retailPrice ??
    info.taxIncludedPrice ??
    undefined;
  if (raw === undefined) return null;
  const parsed = typeof raw === 'string' ? parseFloat(raw) : raw;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Search BigBuy catalog.
 * Fetches product list + product information + first image in parallel.
 * // CONFIRM: pagination params for /rest/catalog/products.json
 *   (assuming ?isoCode=FR&offset=0&limit=20 or similar)
 */
export async function searchBigBuyProducts(params: {
  keywords: string;
  page?: number;
  pageSize?: number;
}): Promise<SupplierSearchResult> {
  if (!BB_API_KEY) {
    return { success: false, products: [], error: 'BIGBUY_API_KEY not configured', needsAuth: true };
  }

  try {
    const limit = Math.min(params.pageSize || 20, 100);
    const offset = ((params.page || 1) - 1) * limit;

    // /rest/catalog/products.json — full product list with basic fields
    // // CONFIRM: search/filter by keyword param name. BigBuy may not expose
    // keyword search at the catalog level (feed model). If no keyword param,
    // we filter client-side on title.
    const allProducts = await bbFetch<BBProductInfo[]>(
      `/rest/catalog/products.json?isoCode=FR&offset=${offset}&limit=${limit}`,
    );

    // Client-side keyword filter (case-insensitive, space-separated tokens)
    const tokens = params.keywords
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const filtered = tokens.length
      ? allProducts.filter((p) =>
          tokens.every((t) => p.name?.toLowerCase().includes(t)),
        )
      : allProducts;

    if (filtered.length === 0) {
      return { success: true, products: [], total: 0 };
    }

    // Fetch images for matched products in parallel (up to limit)
    const slice = filtered.slice(0, limit);
    const imageResults = await Promise.allSettled(
      slice.map((p) =>
        bbFetch<BBProductImage[]>(
          `/rest/catalog/productimages/${p.id}.json`,
        ).catch(() => [] as BBProductImage[]),
      ),
    );

    const products = slice
      .map((p, i) => {
        const price = extractPrice(p);
        // Skip products whose price cannot be resolved to a positive number —
        // emitting price:0 would produce fake infinite-margin products.
        if (price === null) return null;

        const images =
          imageResults[i]?.status === 'fulfilled'
            ? (imageResults[i] as PromiseFulfilledResult<BBProductImage[]>).value
            : [];
        const sortedImages = [...images].sort(
          (a, b) => (a.position ?? 99) - (b.position ?? 99),
        );
        const imageUrl = sortedImages[0]?.url ?? '';
        return {
          supplier: 'bigbuy' as const,
          externalId: p.sku,
          title: p.name,
          price,
          imageUrl,
          supplierUrl: `https://www.bigbuy.eu/en/product/${p.id}`,
          weightGrams: p.weight ?? undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return { success: true, products, total: allProducts.length };
  } catch (e) {
    const err = e as Error & { status?: number };
    return {
      success: false,
      products: [],
      error: err.message ?? 'Unknown BigBuy error',
      needsAuth: err.status === 401,
    };
  }
}

/**
 * Get available carrier for a new BigBuy order.
 * // CONFIRM: endpoint path and response shape.
 */
async function getFirstCarrierId(): Promise<number> {
  const carriers = await bbFetch<BBCarrier[]>('/rest/order/carriers/new.json');
  if (!carriers?.length) throw new Error('BigBuy: no carriers available');
  return carriers[0]!.id;
}

/**
 * Check stock availability before placing a real order.
 * Fails closed: if check fails, we do NOT proceed with the order.
 */
async function checkOrder(
  internalReference: string,
  products: { reference: string; quantity: number }[],
  carrierId: number,
  address: {
    firstName: string;
    lastName: string;
    country: string;
    postcode: string;
    town: string;
    address: string;
    phone: string;
  },
): Promise<void> {
  const body = {
    order: {
      internalReference,
      language: 'fr',
      shippingAddress: address,
      products,
      carriers: [{ id: carrierId }],
    },
  };
  await bbFetch<unknown>('/rest/order/check.json', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  // BigBuy returns 200 on success; any error throws via bbFetch
}

/**
 * Create a BigBuy dropshipping order.
 * Two-step: check → create. Fails closed on any error in either step.
 */
export async function placeBigBuyOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  if (!BB_API_KEY) {
    return { success: false, raw: null, error: 'BIGBUY_API_KEY not configured' };
  }

  try {
    const carrierId = await getFirstCarrierId();

    const shippingAddress = {
      firstName: input.address.fullName.split(' ')[0] ?? input.address.fullName,
      lastName: input.address.fullName.split(' ').slice(1).join(' ') || input.address.contactPerson,
      country: input.address.countryCode,
      postcode: input.address.zip,
      town: input.address.city,
      address: input.address.address1 + (input.address.address2 ? `, ${input.address.address2}` : ''),
      phone: `+${input.address.phoneDial}${input.address.phoneNumber}`,
    };

    const products = input.items.map((item) => ({
      reference: item.externalId,
      quantity: item.quantity,
    }));

    // Step 1: Stock availability check (fails closed)
    await checkOrder(input.outOrderId, products, carrierId, shippingAddress);

    // Step 2: Actual order creation
    const body = {
      order: {
        internalReference: input.outOrderId,
        language: 'fr',
        shippingAddress,
        products,
        carriers: [{ id: carrierId }],
      },
    };

    const raw = await bbFetch<{ order?: { id?: string | number } }>('/rest/order/create.json', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const supplierOrderId = String(raw?.order?.id ?? '');
    return {
      success: true,
      supplierOrderId: supplierOrderId || undefined,
      raw,
    };
  } catch (e) {
    const err = e as Error & { status?: number };
    return {
      success: false,
      raw: null,
      error: err.message ?? 'Unknown BigBuy order error',
    };
  }
}

/**
 * Get tracking info for a BigBuy order.
 * // CONFIRM: path and response shape for /rest/tracking/order/{id}.json
 */
export async function getBigBuyTracking(
  supplierOrderId: string,
): Promise<TrackingResult> {
  if (!BB_API_KEY) {
    return { success: false, raw: null, error: 'BIGBUY_API_KEY not configured' };
  }
  try {
    const raw = await bbFetch<{
      trackingNumber?: string;
      carrier?: string;
      status?: string;
    }>(`/rest/tracking/order/${encodeURIComponent(supplierOrderId)}.json`);
    return {
      success: true,
      trackingNumber: raw.trackingNumber,
      carrier: raw.carrier,
      status: raw.status,
      raw,
    };
  } catch (e) {
    return {
      success: false,
      raw: null,
      error: (e as Error).message ?? 'Unknown tracking error',
    };
  }
}

// ---------------------------------------------------------------------------
// SupplierClient implementation
// ---------------------------------------------------------------------------

export const bigbuyClient: SupplierClient = {
  id: 'bigbuy',
  label: 'BigBuy',
  tier: 'v2',
  status: 'active',
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

  async ensureAuth(): Promise<boolean> {
    return BB_API_KEY.length > 0;
  },

  async searchProducts(params): Promise<SupplierSearchResult> {
    return searchBigBuyProducts({
      keywords: params.keywords,
      page: params.page,
      pageSize: params.pageSize,
    });
  },

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    return placeBigBuyOrder(input);
  },

  async getTracking(supplierOrderId: string): Promise<TrackingResult> {
    return getBigBuyTracking(supplierOrderId);
  },
};
