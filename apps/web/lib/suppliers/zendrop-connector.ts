/**
 * ZendropConnector — backend connector for the Zendrop supplier API.
 *
 * Transport: MCP JSON-RPC 2.0 over HTTPS to ${ZENDROP_MCP_URL} (default
 *   https://app.zendrop.com/mcp/v1), authenticated with a static bearer token.
 *   Body: { jsonrpc:'2.0', id, method:'tools/call', params:{ name, arguments } }
 *   A tool result arrives as { result: { structuredContent, isError, content } }.
 *   We read `structuredContent` (already-parsed JSON) and treat isError as a throw.
 *
 * Auth: the token from the ZENDROP_API_TOKEN env var, sent as
 *   `Authorization: Bearer <token>`. No OAuth flow — the token is a long-lived
 *   Personal API token created in the Zendrop dashboard.
 *
 * Verified live (2026-07) against real tool names: get_stores,
 *   get_catalog_products, get_catalog_product, get_catalog_shipping_estimate,
 *   fulfill_order, get_tracking_events.
 *
 * Configuration:
 *   1. Create an API token in Zendrop (app.zendrop.com) with at least
 *      catalog:read, stores:read (orders:write for fulfillment later).
 *   2. Put it in .env.local as `ZENDROP_API_TOKEN=...` (never commit it).
 *   3. Verify with `node scripts/check-zendrop.mjs` (or zendropConnector.testConnection()).
 *
 * Security: `import 'server-only'` keeps the token off the client bundle; the
 *   token is never logged in full (only a masked prefix in errors).
 */
import 'server-only';

const ZENDROP_MCP_URL = (process.env.SUPPLIER_ZENDROP_MCP_URL || 'https://app.zendrop.com/mcp/v1').trim();
const zendropToken = () => (process.env.ZENDROP_API_TOKEN || '').trim();

/** Internal product shape shared across the platform's supplier connectors. */
export interface ZendropProduct {
  supplier: 'Zendrop';
  supplierProductId: string;
  title: string;
  description?: string;
  images: string[];
  variants?: unknown[];
  costPrice?: number;
  currency?: string;
  stockStatus?: 'in_stock' | 'out_of_stock' | 'unknown';
  raw: unknown;
}

export interface ZendropTestResult {
  ok: boolean;
  detail: string;
  storeCount?: number;
}

export interface ZendropCatalogQuery {
  keyword?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

interface McpEnvelope<T> {
  jsonrpc: '2.0';
  id: number | string;
  result?: {
    structuredContent?: T;
    content?: { type: string; text?: string }[];
    isError?: boolean;
  };
  error?: { code: number; message: string; data?: unknown };
}

/** Never leak the full token in logs — surface only a short prefix. */
function maskToken(t: string): string {
  return t ? `${t.slice(0, 6)}…(${t.length} chars)` : '(empty)';
}

/**
 * Reusable Zendrop API call. Invokes a single MCP tool and returns its
 * `structuredContent` typed as T. Throws on missing token, HTTP error,
 * JSON-RPC error, or a tool-level `isError`.
 */
export async function zendropCall<T = unknown>(
  tool: string,
  args: Record<string, unknown> = {},
  init?: { signal?: AbortSignal },
): Promise<T> {
  const token = zendropToken();
  if (!token) {
    throw new Error('ZENDROP_API_TOKEN is not configured');
  }

  const res = await fetch(ZENDROP_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
    cache: 'no-store',
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Zendrop ${tool} HTTP ${res.status} (token ${maskToken(token)}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as McpEnvelope<T>;
  if (json.error) {
    throw new Error(`Zendrop ${tool} error ${json.error.code}: ${json.error.message}`);
  }
  if (json.result?.isError) {
    const text = json.result.content?.map((c) => c.text).filter(Boolean).join(' ') ?? 'tool error';
    throw new Error(`Zendrop ${tool} tool error: ${text.slice(0, 200)}`);
  }
  return (json.result?.structuredContent ?? {}) as T;
}

// ── Raw Zendrop response shapes (only the fields we consume) ────────────────

interface ZendropRawImage {
  id?: number;
  url?: string;
}

interface ZendropRawProduct {
  id: number;
  name: string;
  description?: string;
  image?: string;
  images?: ZendropRawImage[];
  price?: string | number;
  variants?: unknown[];
}

interface CatalogProductsResponse {
  total: number;
  products: ZendropRawProduct[];
}

interface StoresResponse {
  total: number;
  page: number;
  limit: number;
  stores: { id: number; name?: string }[];
}

/** Map a raw Zendrop catalog product to the platform's internal shape. */
export function toZendropProduct(p: ZendropRawProduct): ZendropProduct {
  const images = (p.images ?? [])
    .map((i) => i.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
  if (!images.length && p.image) images.push(p.image);

  const cost = typeof p.price === 'string' ? parseFloat(p.price) : p.price;

  return {
    supplier: 'Zendrop',
    supplierProductId: String(p.id),
    title: p.name,
    description: p.description,
    images,
    variants: p.variants,
    costPrice: typeof cost === 'number' && !Number.isNaN(cost) ? cost : undefined,
    // Zendrop catalog prices are quoted in USD.
    currency: 'USD',
    // The catalog list does not expose per-variant stock; treat as unknown
    // until a detail/inventory lookup says otherwise.
    stockStatus: 'unknown',
    raw: p,
  };
}

/**
 * The Zendrop connector. Phase 1 exposes connectivity + catalog read; the
 * remaining methods (detail, shipping, fulfillment, tracking) are wired to the
 * real tools and ready to be built out.
 */
export const zendropConnector = {
  /** True once ZENDROP_API_TOKEN is present (does not hit the network). */
  isConfigured(): boolean {
    return zendropToken().length > 0;
  },

  /** Verify the token works by listing stores (stores:read). */
  async testConnection(init?: { signal?: AbortSignal }): Promise<ZendropTestResult> {
    if (!this.isConfigured()) {
      return { ok: false, detail: 'ZENDROP_API_TOKEN manquant dans .env.local' };
    }
    try {
      const data = await zendropCall<StoresResponse>('get_stores', { limit: 1 }, init);
      return {
        ok: true,
        detail: 'Connexion Zendrop OK',
        storeCount: data.total ?? data.stores?.length ?? 0,
      };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : 'Erreur Zendrop' };
    }
  },

  /** Search / browse the Zendrop catalog (catalog:read), mapped to internal format. */
  async getCatalogProducts(
    query: ZendropCatalogQuery = {},
    init?: { signal?: AbortSignal },
  ): Promise<{ total: number; products: ZendropProduct[] }> {
    const args: Record<string, unknown> = {};
    if (query.keyword) args.keyword = query.keyword;
    if (query.categoryId != null) args.category_id = query.categoryId;
    if (query.minPrice != null) args.min_price = query.minPrice;
    if (query.maxPrice != null) args.max_price = query.maxPrice;
    if (query.page != null) args.page = query.page;
    args.limit = query.limit ?? 20;

    const data = await zendropCall<CatalogProductsResponse>('get_catalog_products', args, init);
    return {
      total: data.total ?? 0,
      products: (data.products ?? []).map(toZendropProduct),
    };
  },

  // ── Structure prête pour la suite (branchée sur les vrais outils) ─────────

  /** Full detail for one catalog product (catalog:read). */
  async getProductDetail(productId: string, init?: { signal?: AbortSignal }): Promise<ZendropProduct> {
    const raw = await zendropCall<ZendropRawProduct>('get_catalog_product', { product_id: Number(productId) }, init);
    return toZendropProduct(raw);
  },

  /** Estimate shipping cost for a product to a destination country (catalog:read). */
  async getShippingEstimate(
    productId: string,
    countryCode: string,
    init?: { signal?: AbortSignal },
  ): Promise<unknown> {
    return zendropCall('get_catalog_shipping_estimate', { product_id: Number(productId), country_code: countryCode }, init);
  },

  /** List the merchant's connected stores (stores:read). */
  async listStores(init?: { signal?: AbortSignal }): Promise<StoresResponse> {
    return zendropCall<StoresResponse>('get_stores', {}, init);
  },

  /**
   * Forward an order to Zendrop for direct-to-customer fulfillment (orders:write).
   * Zendrop `fulfill_order` is a two-step (confirm) flow keyed by store_id; this
   * requires a connected store, which the account does not have yet. Left as the
   * documented entry point for the next phase (import produit → création commande).
   */
  async fulfillOrder(_input: { storeId: string; orderId?: string; confirm?: boolean }): Promise<never> {
    throw new Error('fulfillOrder: not implemented yet (requires a connected Zendrop store — get_stores returned 0)');
  },

  /** Shipment tracking history for a tracking number (orders:read). */
  async getTracking(trackingNumber: string, init?: { signal?: AbortSignal }): Promise<unknown> {
    return zendropCall('get_tracking_events', { tracking_number: trackingNumber }, init);
  },
};

export type ZendropConnector = typeof zendropConnector;
