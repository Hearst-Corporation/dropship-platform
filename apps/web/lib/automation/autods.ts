/**
 * AutoDS automation layer — transport bridge for order routing.
 *
 * AutoDS is NOT a product supplier and must never appear in the supplier
 * registry (lib/suppliers/). It is a buyer-account automation service that
 * drives orders through underlying sources (AliExpress, eBay, Walmart, …)
 * using your connected buyer accounts. The underlying supplier still passes
 * the dropship-pur policy gate before AutoDS is invoked.
 *
 * Env vars required:
 *   AUTODS_API_URL          — base URL (default: https://gw.autods.com)
 *   AUTODS_BUYER_ACCOUNT_ID — the buyer-account ID registered in AutoDS
 *                             // CONFIRM: AutoDS calls this "dsp_id" or "account_id"
 *                             //          in their auto-order endpoint
 *
 * Platform settings key (AES-256-GCM via secrets.ts):
 *   autods_api_token        — Bearer token from AutoDS API settings
 */

import { getDb } from '@/lib/db';
import { tryDecryptSecret } from '@/lib/secrets';

// ---------------------------------------------------------------------------
// Identity descriptor — NOT a SupplierClient, not in the registry
// ---------------------------------------------------------------------------

export const AUTODS = {
  id: 'autods',
  label: 'AutoDS (automation)',
  kind: 'automation' as const,
  status: 'automation' as const,
} as const;

// ---------------------------------------------------------------------------
// Internal: resolve the Bearer token from platform_settings
// ---------------------------------------------------------------------------

async function getAutodsToken(): Promise<string | null> {
  try {
    const { rows } = await getDb().query<{
      value: string | null;
      value_enc: Buffer | null;
      value_nonce: Buffer | null;
    }>(
      `SELECT value, value_enc, value_nonce
         FROM platform_settings
        WHERE key = 'autods_api_token'
        LIMIT 1`,
    );
    const row = rows[0];
    if (!row) return null;
    return tryDecryptSecret(row.value_enc, row.value_nonce) ?? row.value ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// routeOrderViaAutoDS
// ---------------------------------------------------------------------------

export interface AutoDSRouteInput {
  /** Our Medusa order id — used as the idempotency / external reference. */
  outOrderId: string;
  /** The underlying supplier the buyer account will purchase from (e.g. 'aliexpress'). */
  underlyingSupplier: string;
  /** Shipping address in the supplier-neutral shape from PlaceOrderInput. */
  address: {
    fullName: string;
    contactPerson: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    countryCode: string;
    zip: string;
    phoneDial: string;
    phoneNumber: string;
  };
  /** Items to order through AutoDS. */
  items: Array<{
    externalId: string;
    quantity: number;
    skuAttr?: string;
  }>;
}

export interface AutoDSRouteResult {
  success: boolean;
  /** AutoDS-assigned order id. */
  autodsOrderId?: string;
  /** Raw response body from AutoDS for persistence / debugging. */
  raw: unknown;
  error?: string;
}

/**
 * Route an order through AutoDS automation layer.
 *
 * POST to AutoDS auto-order endpoint.
 * // CONFIRM endpoint path: AutoDS uses /auto-order/create or /v1/orders/create
 * //   depending on API tier. Check AutoDS API docs for the exact path and
 * //   the accepted JSON body shape (buyer_account_id vs dsp_id, items schema).
 */
export async function routeOrderViaAutoDS(input: AutoDSRouteInput): Promise<AutoDSRouteResult> {
  const token = await getAutodsToken();
  if (!token) {
    return {
      success: false,
      raw: null,
      error: 'AutoDS API token not configured — set autods_api_token in platform_settings',
    };
  }

  const buyerAccountId = process.env.AUTODS_BUYER_ACCOUNT_ID;
  if (!buyerAccountId) {
    return {
      success: false,
      raw: null,
      error: 'AUTODS_BUYER_ACCOUNT_ID env var is not set',
    };
  }

  const baseUrl = (process.env.AUTODS_API_URL ?? 'https://gw.autods.com').replace(/\/$/, '');

  // Build the request body.
  // // CONFIRM: AutoDS auto-order body shape — adjust field names to match
  // //   the actual AutoDS API contract (e.g. buyer_account_id, product_id,
  // //   variant_sku, shipping_address fields).
  const body = {
    buyer_account_id: buyerAccountId,
    external_order_id: input.outOrderId,
    source: input.underlyingSupplier,
    shipping_address: {
      full_name: input.address.fullName,
      contact_person: input.address.contactPerson,
      address_line1: input.address.address1,
      address_line2: input.address.address2 ?? '',
      city: input.address.city,
      state: input.address.province,
      country_code: input.address.countryCode,
      postal_code: input.address.zip,
      phone_country_code: input.address.phoneDial,
      phone_number: input.address.phoneNumber,
    },
    items: input.items.map((item) => ({
      product_id: item.externalId,        // // CONFIRM: field name (product_id vs item_id vs sku)
      quantity: item.quantity,
      ...(item.skuAttr ? { sku_attr: item.skuAttr } : {}),
    })),
  };

  let raw: unknown = null;
  try {
    // // CONFIRM path segment: /auto-order/create vs /v1/orders/create vs /orders
    const res = await fetch(`${baseUrl}/auto-order/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    const text = await res.text();
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }

    if (!res.ok) {
      return {
        success: false,
        raw,
        error: `AutoDS HTTP ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    // // CONFIRM: response shape — AutoDS may return { order_id } or { data: { id } }
    //   or { autods_order_id } etc. Adjust the field extraction below.
    const data = raw as Record<string, unknown>;
    const autodsOrderId =
      (data['order_id'] as string | undefined) ??
      (data['autods_order_id'] as string | undefined) ??
      ((data['data'] as Record<string, unknown> | undefined)?.['id'] as string | undefined);

    return {
      success: true,
      autodsOrderId,
      raw,
    };
  } catch (e) {
    return {
      success: false,
      raw,
      error: e instanceof Error ? e.message : 'AutoDS fetch error',
    };
  }
}

// ---------------------------------------------------------------------------
// getAutoDSTracking
// ---------------------------------------------------------------------------

export interface AutoDSTrackingResult {
  trackingNumber?: string;
  carrier?: string;
  status?: string;
  /** Raw response body for persistence / debugging. */
  raw: unknown;
}

/**
 * Retrieve tracking info from AutoDS for a previously placed order.
 *
 * // CONFIRM: tracking endpoint path — AutoDS may use
 * //   GET /auto-order/{id}/tracking or /v1/orders/{id}/tracking
 */
export async function getAutoDSTracking(autodsOrderId: string): Promise<AutoDSTrackingResult> {
  const token = await getAutodsToken();
  if (!token) {
    return { raw: null, status: 'error: token not configured' };
  }

  const baseUrl = (process.env.AUTODS_API_URL ?? 'https://gw.autods.com').replace(/\/$/, '');

  let raw: unknown = null;
  try {
    // // CONFIRM path: /auto-order/{id}/tracking vs /v1/orders/{id}/tracking
    const res = await fetch(`${baseUrl}/auto-order/${encodeURIComponent(autodsOrderId)}/tracking`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    const text = await res.text();
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }

    if (!res.ok) {
      return { raw, status: `error: AutoDS HTTP ${res.status}` };
    }

    // // CONFIRM: response shape — may be { tracking_number, carrier, status }
    //   or { data: { tracking_number, ... } } etc.
    const data = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const inner = (data['data'] as Record<string, unknown> | undefined) ?? data;

    return {
      trackingNumber: inner['tracking_number'] as string | undefined,
      carrier: inner['carrier'] as string | undefined,
      status: inner['status'] as string | undefined,
      raw,
    };
  } catch (e) {
    return {
      raw,
      status: `error: ${e instanceof Error ? e.message : 'fetch error'}`,
    };
  }
}
