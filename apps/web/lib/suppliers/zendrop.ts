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

/** Operator hint appended to every auth-related error message. */
const OAUTH_HINT = 'lancer le flux OAuth Zendrop dans Réglages (/api/zendrop/oauth/start)';

/** Collapse whitespace and truncate a response body for error messages. */
function excerpt(s: string, max = 300): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
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
  const url = mcpUrl();

  let res: Response;
  try {
    res = await fetch(url, {
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
  } catch (e) {
    // Network-level failure (DNS, refused, timeout) — surface the real cause.
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Zendrop MCP injoignable (${url}): ${msg}`);
  }

  const text = await res.text().catch(() => '');

  if (!res.ok) {
    throw new Error(`Zendrop MCP HTTP ${res.status} sur ${url}: ${excerpt(text) || '(corps vide)'}`);
  }

  try {
    return JSON.parse(text) as RpcResponse<T>;
  } catch {
    throw new Error(
      `Zendrop MCP: réponse inattendue (HTTP ${res.status}, non-JSON) sur ${url}: ${excerpt(text) || '(corps vide)'}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Token management (mirror of AliExpress pattern)
// ---------------------------------------------------------------------------

interface ZendropTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

async function loadTokens(): Promise<{ tokens: ZendropTokens | null; dbError: string | null }> {
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
    if (rows.length === 0) return { tokens: null, dbError: null };

    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

    const atRow = byKey['zendrop_access_token'];
    if (!atRow) return { tokens: null, dbError: null };
    const accessToken =
      tryDecryptSecret(atRow.value_enc, atRow.value_nonce) ?? atRow.value ?? null;
    if (!accessToken) return { tokens: null, dbError: null };

    const rtRow = byKey['zendrop_refresh_token'];
    const refreshToken: string | undefined = rtRow
      ? (tryDecryptSecret(rtRow.value_enc, rtRow.value_nonce) ?? rtRow.value ?? undefined)
      : undefined;

    const expiresStr = byKey['zendrop_token_expires']?.value;
    const expiresAt = expiresStr ? parseInt(expiresStr, 10) : 0;

    return { tokens: { accessToken, refreshToken, expiresAt }, dbError: null };
  } catch (e) {
    return { tokens: null, dbError: e instanceof Error ? e.message : String(e) };
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
 * Returns the new access token on success, or a failure detail describing
 * exactly why the refresh could not happen.
 */
async function refreshAccessToken(
  refreshToken: string,
): Promise<{ token: string; detail?: undefined } | { token: null; detail: string }> {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) {
    return {
      token: null,
      detail: 'SUPPLIER_ZENDROP_CLIENT_ID / SUPPLIER_ZENDROP_CLIENT_SECRET non configurés',
    };
  }
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
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        token: null,
        detail: `token endpoint HTTP ${res.status}: ${excerpt(body, 120) || '(corps vide)'}`,
      };
    }
    const data = await res.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      return { token: null, detail: 'réponse du token endpoint sans access_token' };
    }

    const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    await saveTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt,
    });
    return { token: data.access_token };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { token: null, detail: `token endpoint injoignable: ${msg}` };
  }
}

/**
 * Returns a valid access token (refreshing if expired), or an actionable
 * error message explaining why not — the message is surfaced verbatim to the
 * operator by the supplier registry (`zendrop: <error>`).
 */
async function getAccessTokenDetailed(): Promise<
  { token: string; error?: undefined } | { token: null; error: string }
> {
  const { tokens, dbError } = await loadTokens();

  if (dbError) {
    return {
      token: null,
      error: `Zendrop: lecture du token OAuth impossible (platform_settings): ${dbError}`,
    };
  }

  if (!tokens) {
    return {
      token: null,
      error: `Zendrop non connecté: aucun token OAuth dans platform_settings — ${OAUTH_HINT}`,
    };
  }

  // Token still valid (with 5-min buffer)
  if (tokens.expiresAt === 0 || Date.now() < tokens.expiresAt - 300_000) {
    return { token: tokens.accessToken };
  }

  // Expired — try refresh
  if (!tokens.refreshToken) {
    return {
      token: null,
      error: `Zendrop: token OAuth expiré (aucun refresh token stocké) — ${OAUTH_HINT}`,
    };
  }
  const refreshed = await refreshAccessToken(tokens.refreshToken);
  if (refreshed.token) return { token: refreshed.token };
  return {
    token: null,
    error: `Zendrop: token OAuth expiré et rafraîchissement échoué (${refreshed.detail}) — ${OAUTH_HINT}`,
  };
}

// ---------------------------------------------------------------------------
// SupplierClient implementation
// ---------------------------------------------------------------------------

/**
 * ⚠️ NOT the client wired into the registry. This is the OAuth2+PKCE variant,
 * still unverified against a live account. `lib/suppliers/registry.ts` imports
 * `zendropClient` from `./zendrop-connector` (token auth, verified live).
 *
 * Both files export a symbol named `zendropClient`, so a mistaken import is
 * easy to make — it already happened once. Status is therefore declared
 * honestly as `search_only`: nothing here has proven it can forward a real
 * customer order, and claiming `active` would let the platform believe
 * fulfillment works when it does not.
 */
export const zendropClient: SupplierClient = {
  id: 'zendrop',
  label: 'Zendrop',
  tier: 'v1',
  status: 'search_only',
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
    const auth = await getAccessTokenDetailed();
    return auth.token !== null;
  },

  async searchProducts(params): Promise<SupplierSearchResult> {
    const auth = await getAccessTokenDetailed();
    if (!auth.token) {
      return { success: false, products: [], needsAuth: true, error: auth.error };
    }
    const token = auth.token;

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
        error: e instanceof Error ? e.message : `Zendrop: erreur inattendue: ${String(e)}`,
      };
    }
  },

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    const auth = await getAccessTokenDetailed();
    if (!auth.token) {
      return { success: false, raw: null, error: auth.error };
    }
    const token = auth.token;

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
        error: e instanceof Error ? e.message : `Zendrop: erreur inattendue: ${String(e)}`,
      };
    }
  },

  async getTracking(supplierOrderId: string): Promise<TrackingResult> {
    const auth = await getAccessTokenDetailed();
    if (!auth.token) {
      return { success: false, raw: null, error: auth.error };
    }
    const token = auth.token;

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
        error: e instanceof Error ? e.message : `Zendrop: erreur inattendue: ${String(e)}`,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Exported for use by the OAuth routes (token persistence)
// ---------------------------------------------------------------------------

export { saveTokens as saveZendropTokens };
