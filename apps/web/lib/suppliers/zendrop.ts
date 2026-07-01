/**
 * Zendrop supplier client
 *
 * Transport: MCP JSON-RPC 2.0 over HTTPS
 *   POST ${SUPPLIER_ZENDROP_MCP_URL}
 *   Authorization: Bearer <access_token>
 *   Body: { jsonrpc:'2.0', id, method:'tools/call', params:{ name:<tool>, arguments:{...} } }
 *
 * Auth: OAuth2 Authorization Code + PKCE. Tokens stored AES-256-GCM encrypted
 * in platform_settings (keys: zendrop_access_token / zendrop_refresh_token /
 * zendrop_token_expires), same pattern as AliExpress.
 *
 * // CONFIRM: all tool names below (prefixed with // CONFIRM) against the
 * live Zendrop MCP spec. The names used here are best-guess from public Zendrop
 * API docs and must be verified before production.
 *
 * // CONFIRM: USD→EUR conversion rate is approximated at 0.92 here.
 * Replace with a real FX rate from a live endpoint if needed.
 *
 * // CONFIRM: Zendrop OAuth authorize URL and token URL below.
 */
import type {
  SupplierClient,
  SupplierSearchResult,
  PlaceOrderInput,
  PlaceOrderResult,
  TrackingResult,
} from './types';
import { getDb } from '@/lib/db';
import { encryptSecret, tryDecryptSecret } from '@/lib/secrets';
import { usdToEur } from './fx';

// Read config at call time (not module load) so env stubbed after import is
// honored — matters for tests (vi.stubEnv) and runtime env mutation.
const mcpUrl = () => (process.env.SUPPLIER_ZENDROP_MCP_URL || 'https://app.zendrop.com/mcp/v1').trim();
const clientId = () => (process.env.SUPPLIER_ZENDROP_CLIENT_ID || '').trim();
const clientSecret = () => (process.env.SUPPLIER_ZENDROP_CLIENT_SECRET || '').trim();

// // CONFIRM: these authorize and token endpoint URLs against Zendrop OAuth docs.
export const ZENDROP_AUTHORIZE_URL = 'https://app.zendrop.com/oauth/authorize';
export const ZENDROP_TOKEN_URL = 'https://app.zendrop.com/oauth/token';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;
function nextRpcId(): number {
  return ++_idCounter;
}

interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Send a single JSON-RPC 2.0 call to the Zendrop MCP endpoint.
 * Requires a valid Bearer token — caller must call ensureAuth() first.
 */
async function rpc<T = unknown>(
  token: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<RpcResponse<T>> {
  const id = nextRpcId();
  const res = await fetch(mcpUrl(), {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });

  if (!res.ok) {
    throw new Error(`Zendrop MCP HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }

  return res.json() as Promise<RpcResponse<T>>;
}

// ---------------------------------------------------------------------------
// Token management (mirror of AliExpress pattern)
// ---------------------------------------------------------------------------

interface ZendropTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

async function loadTokens(): Promise<ZendropTokens | null> {
  try {
    const db = getDb();
    const { rows } = await db.query<{
      key: string;
      value: string | null;
      value_enc: Buffer | null;
      value_nonce: Buffer | null;
    }>(
      `SELECT key, value, value_enc, value_nonce
       FROM platform_settings
       WHERE key IN ('zendrop_access_token','zendrop_refresh_token','zendrop_token_expires')`,
    );
    if (rows.length === 0) return null;

    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

    const atRow = byKey['zendrop_access_token'];
    if (!atRow) return null;
    const accessToken =
      tryDecryptSecret(atRow.value_enc, atRow.value_nonce) ?? atRow.value ?? null;
    if (!accessToken) return null;

    const rtRow = byKey['zendrop_refresh_token'];
    const refreshToken: string | undefined = rtRow
      ? (tryDecryptSecret(rtRow.value_enc, rtRow.value_nonce) ?? rtRow.value ?? undefined)
      : undefined;

    const expiresStr = byKey['zendrop_token_expires']?.value;
    const expiresAt = expiresStr ? parseInt(expiresStr, 10) : 0;

    return { accessToken, refreshToken, expiresAt };
  } catch {
    return null;
  }
}

async function saveTokens(tokens: {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}): Promise<void> {
  const db = getDb();
  const encAccess = encryptSecret(tokens.accessToken);
  const encRefresh = tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null;

  await db.query(
    `INSERT INTO platform_settings (key, value, value_enc, value_nonce, updated_at)
     VALUES
       ('zendrop_access_token',  NULL, $1,   $2,   now()),
       ('zendrop_refresh_token', NULL, $3,   $4,   now()),
       ('zendrop_token_expires', $5,   NULL, NULL, now())
     ON CONFLICT (key) DO UPDATE
       SET value       = EXCLUDED.value,
           value_enc   = EXCLUDED.value_enc,
           value_nonce = EXCLUDED.value_nonce,
           updated_at  = now()`,
    [
      encAccess.encrypted,
      encAccess.nonce,
      encRefresh ? encRefresh.encrypted : null,
      encRefresh ? encRefresh.nonce : null,
      String(tokens.expiresAt),
    ],
  );
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new access token on success, null otherwise.
 */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) return null;
  try {
    const res = await fetch(ZENDROP_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: id,
        client_secret: secret,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return null;

    const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    await saveTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt,
    });
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Returns a valid access token (refreshing if expired), or null when not
 * authenticated. The SupplierClient.ensureAuth() caller must redirect to
 * /api/zendrop/oauth/start when this returns null.
 */
async function getAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  // Token still valid (with 5-min buffer)
  if (tokens.expiresAt === 0 || Date.now() < tokens.expiresAt - 300_000) {
    return tokens.accessToken;
  }

  // Try refresh
  if (tokens.refreshToken) {
    return refreshAccessToken(tokens.refreshToken);
  }
  return null;
}

// ---------------------------------------------------------------------------
// SupplierClient implementation
// ---------------------------------------------------------------------------

export const zendropClient: SupplierClient = {
  id: 'zendrop',
  label: 'Zendrop',
  tier: 'v1',
  status: 'active',
  capabilities: {
    unitOrder: true,
    noStock: true,
    directShip: true,
    neutralPackaging: true,
    stockPriceSync: true,
    tracking: true,
    returns: true,
    imageRights: false,
  },

  async ensureAuth(): Promise<boolean> {
    const token = await getAccessToken();
    return token !== null;
  },

  async searchProducts(params): Promise<SupplierSearchResult> {
    const token = await getAccessToken();
    if (!token) {
      return { success: false, products: [], needsAuth: true };
    }

    try {
      // // CONFIRM: tool name. Alternatives: 'catalog_search', 'search_products',
      // 'get_catalog_products'. Using 'get_catalog_trending_products' for
      // trending / 'get_catalog_product' for keyword lookup per Zendrop MCP spec.
      const toolName = 'get_catalog_products';
      const resp = await rpc<{
        products?: Array<{
          id?: string;
          title?: string;
          price?: number;         // USD // CONFIRM
          image_url?: string;
          product_url?: string;
          weight_grams?: number;
        }>;
        total?: number;
      }>(token, toolName, {
        query: params.keywords,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 20,
      });

      if (resp.error) {
        return {
          success: false,
          products: [],
          error: `Zendrop MCP error ${resp.error.code}: ${resp.error.message}`,
        };
      }

      const rawProducts = resp.result?.products ?? [];
      const products = rawProducts.map((p) => ({
        supplier: 'zendrop' as const,
        externalId: String(p.id ?? ''),
        title: p.title ?? '',
        // // CONFIRM: price currency. Converting from USD if Zendrop returns USD.
        price: usdToEur(p.price ?? 0),
        imageUrl: p.image_url ?? '',
        supplierUrl: p.product_url ?? '',
        weightGrams: p.weight_grams,
      }));

      return {
        success: true,
        products,
        total: resp.result?.total ?? products.length,
      };
    } catch (e) {
      return {
        success: false,
        products: [],
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  },

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    const token = await getAccessToken();
    if (!token) {
      return { success: false, raw: null, error: 'Zendrop: not authenticated — visit /api/zendrop/oauth/start' };
    }

    try {
      // // CONFIRM: tool name for order placement. Alternatives: 'create_order',
      // 'place_order', 'orders_create'.
      const toolName = 'create_order';
      const resp = await rpc<{
        order_id?: string;
        success?: boolean;
        error?: string;
      }>(token, toolName, {
        reference_id: input.outOrderId,
        shipping_address: {
          full_name: input.address.fullName,
          contact_person: input.address.contactPerson,
          address1: input.address.address1,
          address2: input.address.address2 ?? null,
          city: input.address.city,
          province: input.address.province,
          country_code: input.address.countryCode,
          zip: input.address.zip,
          phone_dial: input.address.phoneDial,
          phone_number: input.address.phoneNumber,
        },
        items: input.items.map((item) => ({
          product_id: item.externalId,
          quantity: item.quantity,
        })),
      });

      if (resp.error) {
        return {
          success: false,
          raw: resp,
          error: `Zendrop MCP error ${resp.error.code}: ${resp.error.message}`,
        };
      }

      const orderId = resp.result?.order_id;
      if (!orderId) {
        return {
          success: false,
          raw: resp,
          error: 'Zendrop: order placed but no order_id returned',
        };
      }

      return { success: true, supplierOrderId: String(orderId), raw: resp };
    } catch (e) {
      return {
        success: false,
        raw: null,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  },

  async getTracking(supplierOrderId: string): Promise<TrackingResult> {
    const token = await getAccessToken();
    if (!token) {
      return {
        success: false,
        raw: null,
        error: 'Zendrop: not authenticated — visit /api/zendrop/oauth/start',
      };
    }

    try {
      // // CONFIRM: tool name. Alternatives: 'get_order', 'order_status',
      // 'get_order_tracking'.
      const toolName = 'get_order_tracking';
      const resp = await rpc<{
        tracking_number?: string;
        carrier?: string;
        status?: string;
      }>(token, toolName, { order_id: supplierOrderId });

      if (resp.error) {
        return {
          success: false,
          raw: resp,
          error: `Zendrop MCP error ${resp.error.code}: ${resp.error.message}`,
        };
      }

      return {
        success: true,
        trackingNumber: resp.result?.tracking_number,
        carrier: resp.result?.carrier,
        status: resp.result?.status,
        raw: resp,
      };
    } catch (e) {
      return {
        success: false,
        raw: null,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Exported for use by the OAuth routes (token persistence)
// ---------------------------------------------------------------------------

export { saveTokens as saveZendropTokens };
