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
  productWeight: string;
  sellPrice: number;
  categoryId: string;
  categoryName: string;
  sourceFrom: number;
  sellUrl: string;
  variants?: {
    vid: string;
    variantNameEn: string;
    variantImage: string;
    variantSellPrice: number;
  }[];
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
  tokenExpiresAt = Date.now() + 3600 * 1000; // 1h

  if (!accessToken) {
    throw new Error('CJ API returned empty access token');
  }

  return accessToken;
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
// Product search (unchanged from v1)
// ---------------------------------------------------------------------------

export async function searchProducts(params: {
  keywords: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
}): Promise<{ success: boolean; data?: CJSearchResult; error?: string }> {
  try {
    const headers = await authHeaders();

    const body = {
      keyWords: params.keywords,
      pageNum: params.page || 1,
      pageSize: params.pageSize || 20,
      ...(params.categoryId && { categoryId: params.categoryId }),
    };

    const response = await fetch(`${API_BASE}/product/list`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`CJ API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 200 || !data.result) {
      throw new Error(data.message || 'CJ API error');
    }

    return {
      success: true,
      data: {
        total: data.data.total || 0,
        pageNum: data.data.pageNum || 1,
        pageSize: data.data.pageSize || 20,
        list: data.data.list || [],
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

    // Step 1 — resolve vid for each item.
    const resolvedItems: { vid: string; quantity: number }[] = [];
    for (const item of items) {
      const vid = await resolveVariantVid(item.externalId);
      if (!vid) {
        return {
          success: false,
          raw: null,
          error: `cj variant unresolved for pid=${item.externalId}`,
        };
      }
      resolvedItems.push({ vid, quantity: item.quantity });
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
      price: p.sellPrice,
      imageUrl: p.productImage,
      supplierUrl: p.sellUrl || '',
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
