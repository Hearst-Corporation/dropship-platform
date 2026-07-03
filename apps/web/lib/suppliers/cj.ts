/**
 * CJ Dropshipping API client — v2 (fulfillment-capable)
 * Docs: https://developers.cjdropshipping.com/api2.0/v1/authentication
 *
 * Fulfillment flow (NO auto-pay):
 *   1. Resolve variant vid from pid via POST /product/variant/query
 *   2. Create order via POST /shopping/order/createOrderV2
 *   3. Confirm order via PATCH /shopping/order/confirmOrder
 *
 * Paying the order (POST /shopping/order/payBalanceV2) is intentionally
 * NOT called here — it moves real money. An admin must pay manually in the
 * CJ dashboard or a separate privileged backend step.
 */
import type {
  SupplierClient,
  SupplierSearchResult,
  PlaceOrderInput,
  PlaceOrderResult,
  TrackingResult,
} from './types';
import { usdToEur } from './fx';

// Read credentials at call time (not module load) so env is picked up even
// when set after import — matters for tests (vi.stubEnv in beforeAll/beforeEach)
// and for any runtime that mutates process.env after module init.
const cjEmail = () => (process.env.CJ_DROPSHIPPING_EMAIL || '').trim();
const cjApiKey = () => (process.env.CJ_DROPSHIPPING_API_KEY || '').trim();
const API_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

let accessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Clear the module-level token cache. Exported for tests so each case can
 * force a fresh authenticate() call (the cache otherwise survives across
 * tests within the same module lifetime and leaks a token between them).
 */
export function __resetCjAuthCache(): void {
  accessToken = null;
  tokenExpiresAt = 0;
}

interface CJProduct {
  pid: string;
  productNameEn: string;
  productImage: string;
  /** Grams; may be a range string like "1730.00-3200.00". */
  productWeight: string;
  /**
   * USD. The GET /product/list endpoint returns a STRING, sometimes a range
   * like "14.59 -- 24.05" (variant min/max). Verified against the live API
   * on 2026-07-02.
   */
  sellPrice: string | number;
  categoryId: string;
  categoryName: string;
  sourceFrom: string | number;
}

interface CJSearchResult {
  total: number;
  pageNum: number;
  pageSize: number;
  list: CJProduct[];
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Returns a valid CJ access token, refreshing if expired.
 * Throws on credential misconfiguration or API errors.
 */
async function authenticate(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const email = cjEmail();
  const apiKey = cjApiKey();
  if (!email || !apiKey) {
    throw new Error(
      'CJ Dropshipping credentials not configured (CJ_DROPSHIPPING_EMAIL, CJ_DROPSHIPPING_API_KEY)',
    );
  }

  const response = await fetch(`${API_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey }),
  });

  if (!response.ok) {
    throw new Error(`CJ auth failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.result || data.code !== 200) {
    throw new Error(`CJ auth error: ${data.message || 'Unknown'}`);
  }

  accessToken = data.data.accessToken as string;
  tokenExpiresAt = computeTokenExpiry(data.data);

  if (!accessToken) {
    throw new Error('CJ API returned empty access token');
  }

  return accessToken;
}

/** Refresh this many ms before the real expiry so we never send a stale token. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 min
/** Fallback TTL when CJ returns no usable expiry field. */
const TOKEN_FALLBACK_TTL_MS = 3600 * 1000; // 1h

/**
 * Compute the absolute epoch-ms at which the cached token should be considered
 * stale, derived from the real expiry CJ returns in the auth response (rather
 * than a fixed 1h TTL that silently desyncs if CJ shortens the token lifetime).
 *
 * CJ has returned the expiry under several shapes across API revisions, so we
 * probe defensively:
 *   - absolute epoch: `accessTokenExpiryDate` / `expiryDate` (ms or seconds,
 *     or an ISO-8601 / "YYYY-MM-DD HH:mm:ss" date string)
 *   - relative duration: `expiresIn` / `accessTokenExpiryIn` (seconds)
 *
 * The returned instant is the real expiry minus a safety margin. If nothing
 * usable is present we fall back to the historical 1h TTL (no regression).
 */
function computeTokenExpiry(authData: Record<string, unknown>): number {
  const now = Date.now();

  // 1) Absolute expiry timestamp (epoch ms, epoch seconds, or date string).
  const absoluteRaw =
    authData.accessTokenExpiryDate ?? authData.expiryDate ?? authData.accessTokenExpiry;
  const absoluteMs = parseAbsoluteExpiry(absoluteRaw);
  if (absoluteMs !== null && absoluteMs > now) {
    return Math.max(now, absoluteMs - TOKEN_REFRESH_MARGIN_MS);
  }

  // 2) Relative duration in seconds.
  const relativeRaw =
    authData.expiresIn ?? authData.accessTokenExpiryIn ?? authData.expireIn;
  const relativeSec =
    typeof relativeRaw === 'number'
      ? relativeRaw
      : typeof relativeRaw === 'string' && relativeRaw.trim() !== ''
        ? Number(relativeRaw)
        : NaN;
  if (Number.isFinite(relativeSec) && relativeSec > 0) {
    return Math.max(now, now + relativeSec * 1000 - TOKEN_REFRESH_MARGIN_MS);
  }

  // 3) Fallback: historical fixed 1h TTL.
  return now + TOKEN_FALLBACK_TTL_MS;
}

/**
 * Interpret an absolute-expiry field as epoch ms.
 * Accepts epoch ms, epoch seconds (heuristically upscaled), or a parseable
 * date string. Returns null when the value is absent/unusable.
 */
function parseAbsoluteExpiry(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    // < 1e12 ≈ before year 2001 in ms → it's almost certainly seconds.
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && asNum > 0) {
      return asNum < 1e12 ? asNum * 1000 : asNum;
    }
    // CJ sometimes returns "YYYY-MM-DD HH:mm:ss" (space, no timezone).
    const isoish = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const parsed = Date.parse(isoish);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Auth headers for every authenticated CJ request. */
async function authHeaders(): Promise<HeadersInit> {
  const token = await authenticate();
  return {
    'Content-Type': 'application/json',
    'CJ-Access-Token': token,
  };
}

// ---------------------------------------------------------------------------
// Product search
// ---------------------------------------------------------------------------

/**
 * Parse a CJ numeric field (sellPrice USD, productWeight grams).
 * The list endpoint returns strings, sometimes a variant range like
 * "14.59 -- 24.05" — we take the LOWER bound (cheapest/lightest variant).
 */
export function parseCjNumber(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (!raw) return 0;
  const match = String(raw).match(/\d+(?:\.\d+)?/);
  const value = match ? parseFloat(match[0]) : NaN;
  return Number.isFinite(value) ? value : 0;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Search the CJ catalog.
 *
 * The v2 endpoint is a **GET** with query params — POSTing to it returns
 * `code 16900202 "Request method 'POST' not supported"` (that was the prod
 * failure). Keyword search goes through `productNameEn` (fuzzy match on the
 * English name); the `keyWords` param is silently ignored by the API and
 * returns the whole catalog. Verified against the live API on 2026-07-02.
 *
 * CJ enforces QPS = 1 req/s per endpoint, and authenticate() usually runs
 * right before the first search, so we retry once on 429 / code 1600200.
 */
export async function searchProducts(params: {
  keywords: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
}): Promise<{ success: boolean; data?: CJSearchResult; error?: string }> {
  try {
    const headers = await authHeaders();

    const query = new URLSearchParams({
      productNameEn: params.keywords,
      pageNum: String(params.page || 1),
      pageSize: String(params.pageSize || 20),
      ...(params.categoryId && { categoryId: params.categoryId }),
    });
    const url = `${API_BASE}/product/list?${query.toString()}`;

    const MAX_ATTEMPTS = 3;
    let data: { code: number; result: boolean; message?: string; data?: CJSearchResult } | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(15_000),
        headers,
      });

      const rateLimitedHttp = response.status === 429;
      if (!response.ok && !rateLimitedHttp) {
        throw new Error(`CJ API error: ${response.status}`);
      }

      data = await response.json();
      const rateLimitedBody = data !== null && data.code === 1600200;
      if ((rateLimitedHttp || rateLimitedBody) && attempt < MAX_ATTEMPTS) {
        await sleep(1_200); // QPS window is 1s
        continue;
      }
      break;
    }

    if (!data || data.code !== 200 || !data.result) {
      throw new Error(data?.message || 'CJ API error');
    }

    const payload = data.data;
    return {
      success: true,
      data: {
        total: payload?.total || 0,
        pageNum: payload?.pageNum || 1,
        pageSize: payload?.pageSize || 20,
        list: payload?.list || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ---------------------------------------------------------------------------
// Variant resolution (step 1 of fulfillment)
// ---------------------------------------------------------------------------

/**
 * Resolve the CJ variant vid for a given pid.
 *
 * CJ does not accept a raw pid in the order create call — it needs the
 * variant-level vid. When a product has exactly one variant we auto-pick it;
 * when it has multiple we take the first one (caller can supply a skuAttr in
 * the future to pin a specific variant, but CJ's createOrderV2 accepts vid
 * not skuAttr, so we resolve here).
 *
 * // CONFIRM: endpoint path POST /product/variant/query accepts { pid } and
 * returns { data: { variants: [{vid, ...}] } }.  Alternative path:
 * GET /product/query?pid= returning { data: { variants: [...] } }.
 */
async function resolveVariantVid(pid: string): Promise<string | null> {
  const headers = await authHeaders();

  // Primary: POST /product/variant/query
  // // CONFIRM: this is the preferred variant query endpoint per CJ docs v2.
  const res = await fetch(`${API_BASE}/product/variant/query`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers,
    body: JSON.stringify({ pid }),
  });

  if (!res.ok) {
    throw new Error(`CJ variant query failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.code !== 200 || !data.result) {
    throw new Error(`CJ variant query error: ${data.message || 'Unknown'}`);
  }

  const variants: { vid: string }[] = data.data?.variants || [];
  if (variants.length === 0) {
    return null;
  }
  return variants[0].vid;
}

// ---------------------------------------------------------------------------
// Order fulfillment (steps 2 & 3)
// ---------------------------------------------------------------------------

/**
 * Place and confirm a CJ Dropshipping order.
 *
 * Two-phase, NO auto-pay:
 *   POST /shopping/order/createOrderV2  → orderId + cjPayUrl
 *   PATCH /shopping/order/confirmOrder  → confirms intent
 *
 * Paying (POST /shopping/order/payBalanceV2) moves real money — it is
 * intentionally omitted here and must be done by an admin in the CJ
 * dashboard.
 *
 * // CONFIRM: createOrderV2 body field names match the CJ v2 spec:
 *   orderNumber, shippingZip, shippingCountryCode, shippingProvince,
 *   shippingCity, shippingCustomerName, shippingAddress, shippingAddress2,
 *   shippingPhone, products:[{vid, quantity}]
 */
async function placeOrderCJ(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  try {
    const headers = await authHeaders();
    const { address, items, outOrderId } = input;

    // Step 1 — resolve vid for each item, in parallel (each resolution is an
    // independent HTTP round-trip keyed only by pid — no shared/sequential
    // state between items). Preserves the original fail-fast semantics: a
    // thrown error propagates to the outer try/catch below exactly as the
    // sequential loop did, and the first unresolved vid still short-circuits
    // placeOrderCJ with the same descriptive error.
    const vids = await Promise.all(
      items.map((item) => resolveVariantVid(item.externalId)),
    );
    const resolvedItems: { vid: string; quantity: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const vid = vids[i];
      if (!vid) {
        return {
          success: false,
          raw: null,
          error: `cj variant unresolved for pid=${items[i].externalId}`,
        };
      }
      resolvedItems.push({ vid, quantity: items[i].quantity });
    }

    // Step 2 — create order.
    const createBody = {
      orderNumber: outOrderId,
      shippingZip: address.zip,
      shippingCountryCode: address.countryCode,
      shippingProvince: address.province,
      shippingCity: address.city,
      shippingCustomerName: address.fullName,
      shippingAddress: address.address1,
      ...(address.address2 ? { shippingAddress2: address.address2 } : {}),
      shippingPhone: address.phoneNumber,
      products: resolvedItems,
    };

    const createRes = await fetch(`${API_BASE}/shopping/order/createOrderV2`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers,
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      throw new Error(`CJ createOrderV2 failed: ${createRes.status}`);
    }

    const createData = await createRes.json();
    if (createData.code !== 200 || !createData.result) {
      return {
        success: false,
        raw: createData,
        error: `CJ createOrder error: ${createData.message || 'Unknown'}`,
      };
    }

    const orderId: string = createData.data?.orderId || createData.data?.shipmentOrderId || '';
    if (!orderId) {
      return {
        success: false,
        raw: createData,
        error: 'CJ createOrderV2 returned no orderId',
      };
    }

    // Step 3 — confirm order (signals purchasing intent, still no payment).
    const confirmRes = await fetch(`${API_BASE}/shopping/order/confirmOrder`, {
      method: 'PATCH',
      signal: AbortSignal.timeout(15_000),
      headers,
      body: JSON.stringify({ orderId }),
    });

    if (!confirmRes.ok) {
      // Non-fatal: the order IS created and recoverable — admin can confirm manually.
      // Surface the unconfirmed state in raw so the DB row makes it visible.
      const confirmErrMsg = `HTTP ${confirmRes.status}`;
      console.warn(`[cj] confirmOrder failed for orderId=${orderId}: ${confirmErrMsg}`);
      return {
        success: true,
        supplierOrderId: orderId,
        raw: { create: createData, confirmed: false, confirmError: confirmErrMsg },
      };
    }

    const confirmData = await confirmRes.json();

    // Paying the balance (POST /shopping/order/payBalanceV2) is intentionally
    // omitted — it moves real money and must be triggered by a privileged
    // admin action, not this automated path.

    return {
      success: true,
      supplierOrderId: orderId,
      raw: { create: createData, confirm: confirmData },
    };
  } catch (error) {
    return {
      success: false,
      raw: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ---------------------------------------------------------------------------
// Order tracking
// ---------------------------------------------------------------------------

/**
 * Fetch tracking details for a CJ order.
 *
 * Primary source: GET /shopping/order/getOrderDetail?orderId=
 *   Returns trackNumber + trackingProvider + orderStatus.
 *
 * // CONFIRM: optional secondary call GET /logistic/trackInfo?trackNumber=
 * can be made to get granular carrier events; omitted here for latency.
 */
async function getTrackingCJ(supplierOrderId: string): Promise<TrackingResult> {
  try {
    const headers = await authHeaders();

    const res = await fetch(
      `${API_BASE}/shopping/order/getOrderDetail?orderId=${encodeURIComponent(supplierOrderId)}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(15_000),
        headers,
      },
    );

    if (!res.ok) {
      throw new Error(`CJ getOrderDetail failed: ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== 200 || !data.result) {
      return {
        success: false,
        raw: data,
        error: `CJ getOrderDetail error: ${data.message || 'Unknown'}`,
      };
    }

    const detail = data.data || {};
    const trackingNumber: string | undefined = detail.trackNumber || detail.trackingNumber || undefined;
    const carrier: string | undefined = detail.trackingProvider || detail.carrierName || undefined;
    const status: string | undefined = detail.orderStatus || undefined;

    // // CONFIRM: optionally call GET /logistic/trackInfo?trackNumber=<trackNumber>
    // for more granular carrier events. Skipped here to avoid an extra RTT.

    return {
      success: true,
      status,
      trackingNumber,
      carrier,
      raw: data,
    };
  } catch (error) {
    return {
      success: false,
      raw: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ---------------------------------------------------------------------------
// SupplierClient implementation — pluggable registry adapter
// ---------------------------------------------------------------------------

export const cjClient: SupplierClient = {
  id: 'cj',
  label: 'CJ Dropshipping',
  tier: 'v1',
  status: 'active',
  capabilities: {
    unitOrder: true,
    noStock: true,
    directShip: true,
    neutralPackaging: true,
    stockPriceSync: false,
    tracking: true,
    returns: false,
    imageRights: false,
  },

  async searchProducts(params): Promise<SupplierSearchResult> {
    const result = await searchProducts({
      keywords: params.keywords,
      page: params.page,
      pageSize: params.pageSize,
      categoryId: params.categoryId,
    });
    if (!result.success || !result.data) {
      return { success: false, products: [], error: result.error };
    }
    const products = result.data.list.map((p) => ({
      supplier: 'cj' as const,
      externalId: p.pid,
      title: p.productNameEn,
      // sellPrice is USD (string, possibly a range) → EUR major units.
      price: usdToEur(parseCjNumber(p.sellPrice)),
      imageUrl: p.productImage,
      // The list endpoint has no sellUrl field — build the canonical CJ
      // product page URL from the pid.
      supplierUrl: `https://www.cjdropshipping.com/product/-p-${p.pid}.html`,
      weightGrams: parseCjNumber(p.productWeight) || undefined,
    }));
    return { success: true, products, total: result.data.total };
  },

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    return placeOrderCJ(input);
  },

  async getTracking(supplierOrderId: string): Promise<TrackingResult> {
    return getTrackingCJ(supplierOrderId);
  },
};
