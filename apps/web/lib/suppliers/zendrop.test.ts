/**
 * Zendrop supplier client — unit tests.
 *
 * Transport is MCP JSON-RPC 2.0 over HTTPS (POST to SUPPLIER_ZENDROP_MCP_URL).
 * The DB layer is mocked via vi.mock('@/lib/db') so no real Postgres is needed.
 *
 * Test inventory:
 *   1. JSON-RPC envelope shape — correct jsonrpc/method/params.name on the wire
 *   2. searchProducts: catalog tool → RawProduct mapping (USD→EUR conversion)
 *   3. searchProducts: missing token → needsAuth:true + actionable error message
 *   4. placeOrder: maps address + items, returns supplierOrderId
 *   5. Token refresh: expired token triggers POST to token URL, new token used;
 *      refresh failure yields an explicit "token expiré" error with the cause
 *   6. Transport errors: HTTP non-2xx (status + body excerpt), unreachable
 *      endpoint (network message), non-JSON 200 (unexpected response)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup-msw';
import { zendropClient } from './zendrop';
import { getUsdEurRate } from './fx';

// ---------------------------------------------------------------------------
// DB mock — controls what loadTokens() sees
// ---------------------------------------------------------------------------

const DB_ROWS: Record<string, { key: string; value: string | null; value_enc: Buffer | null; value_nonce: Buffer | null }[]> = {
  withToken: [
    {
      key: 'zendrop_access_token',
      value: 'zd-access-token-test',
      value_enc: null,
      value_nonce: null,
    },
    {
      key: 'zendrop_refresh_token',
      value: 'zd-refresh-token-test',
      value_enc: null,
      value_nonce: null,
    },
    {
      key: 'zendrop_token_expires',
      // '0' = never expires (loadTokens returns the token immediately)
      value: '0',
      value_enc: null,
      value_nonce: null,
    },
  ],
  expiredToken: [
    {
      key: 'zendrop_access_token',
      value: 'zd-expired-token',
      value_enc: null,
      value_nonce: null,
    },
    {
      key: 'zendrop_refresh_token',
      value: 'zd-refresh-token-test',
      value_enc: null,
      value_nonce: null,
    },
    {
      key: 'zendrop_token_expires',
      // epoch ms in the distant past → triggers refresh
      value: '1',
      value_enc: null,
      value_nonce: null,
    },
  ],
  noToken: [],
};

let dbScenario: keyof typeof DB_ROWS = 'withToken';

vi.mock('@/lib/db', () => {
  return {
    getDb: () => ({
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM platform_settings')) {
          return { rows: DB_ROWS[dbScenario] ?? [], rowCount: DB_ROWS[dbScenario]?.length ?? 0 };
        }
        // INSERT / UPSERT — saveTokens() path: just succeed silently
        return { rows: [], rowCount: 0 };
      }),
    }),
  };
});

const MCP_URL = 'https://app.zendrop.com/mcp/v1';
const TOKEN_URL = 'https://app.zendrop.com/oauth/token';

beforeEach(() => {
  dbScenario = 'withToken';
  vi.stubEnv('SUPPLIER_ZENDROP_CLIENT_ID', 'zd-client-id');
  vi.stubEnv('SUPPLIER_ZENDROP_CLIENT_SECRET', 'zd-client-secret');
  vi.stubEnv('SUPPLIER_ZENDROP_MCP_URL', MCP_URL);
  vi.stubEnv('STORE_SECRETS_KEY', 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=');
});

// ---------------------------------------------------------------------------
// 1. JSON-RPC envelope shape
// ---------------------------------------------------------------------------

describe('JSON-RPC envelope', () => {
  it('sends correct jsonrpc/method/params.name on the wire', async () => {
    let captured: unknown = null;

    server.use(
      http.post(MCP_URL, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({
          jsonrpc: '2.0',
          id: 1,
          result: { products: [], total: 0 },
        });
      }),
    );

    await zendropClient.searchProducts({ keywords: 'sunglasses' });

    const body = captured as {
      jsonrpc: string;
      id: number;
      method: string;
      params: { name: string; arguments: Record<string, unknown> };
    };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.method).toBe('tools/call');
    expect(typeof body.id).toBe('number');
    expect(body.params.name).toMatch(/catalog|search|product/i);
    expect(body.params.arguments.query).toBe('sunglasses');
  });

  it('sends Authorization: Bearer <token> header', async () => {
    let authHeader: string | null = null;

    server.use(
      http.post(MCP_URL, ({ request }) => {
        authHeader = request.headers.get('Authorization');
        return HttpResponse.json({ jsonrpc: '2.0', id: 1, result: { products: [], total: 0 } });
      }),
    );

    await zendropClient.searchProducts({ keywords: 'test' });

    expect(authHeader).toBe('Bearer zd-access-token-test');
  });
});

// ---------------------------------------------------------------------------
// 2. searchProducts → RawProduct mapping (USD→EUR)
// ---------------------------------------------------------------------------

describe('zendropClient.searchProducts', () => {
  it('maps catalog result to RawProduct with price converted USD→EUR', async () => {
    server.use(
      http.post(MCP_URL, () =>
        HttpResponse.json({
          jsonrpc: '2.0',
          id: 1,
          result: {
            products: [
              {
                id: 'zd-prod-001',
                title: 'Stylish Sunglasses',
                price: 10.00, // USD → expect ~9.20 EUR (×0.92)
                image_url: 'https://zendrop.com/img/sunglasses.jpg',
                product_url: 'https://zendrop.com/products/sunglasses',
                weight_grams: 120,
              },
            ],
            total: 1,
          },
        }),
      ),
    );

    const result = await zendropClient.searchProducts({ keywords: 'sunglasses' });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);

    const p = result.products[0];
    expect(p.supplier).toBe('zendrop');
    expect(p.externalId).toBe('zd-prod-001');
    expect(p.title).toBe('Stylish Sunglasses');
    expect(p.price).toBeCloseTo(10 * getUsdEurRate(), 4); // 10 USD × rate (default 0.92)
    expect(p.imageUrl).toBe('https://zendrop.com/img/sunglasses.jpg');
    expect(p.supplierUrl).toBe('https://zendrop.com/products/sunglasses');
    expect(p.weightGrams).toBe(120);
  });

  it('returns total from the MCP result', async () => {
    server.use(
      http.post(MCP_URL, () =>
        HttpResponse.json({
          jsonrpc: '2.0',
          id: 1,
          result: {
            products: [
              { id: 'a', title: 'A', price: 5, image_url: '', product_url: '' },
              { id: 'b', title: 'B', price: 8, image_url: '', product_url: '' },
            ],
            total: 42,
          },
        }),
      ),
    );

    const result = await zendropClient.searchProducts({ keywords: 'shoes' });

    expect(result.success).toBe(true);
    expect(result.total).toBe(42);
    expect(result.products).toHaveLength(2);
  });

  it('propagates MCP JSON-RPC error as success:false', async () => {
    server.use(
      http.post(MCP_URL, () =>
        HttpResponse.json({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32001, message: 'Tool not found: get_catalog_products' },
        }),
      ),
    );

    const result = await zendropClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Tool not found/);
  });

  it('returns HTTP status + body excerpt when MCP endpoint answers non-2xx', async () => {
    server.use(
      http.post(MCP_URL, () =>
        HttpResponse.text('{"message":"Internal Server Error at Zendrop"}', { status: 500 }),
      ),
    );

    const result = await zendropClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Zendrop MCP HTTP 500/);
    expect(result.error).toMatch(/Internal Server Error at Zendrop/);
    expect(result.error).toContain(MCP_URL);
  });

  it('returns an explicit network message when MCP endpoint is unreachable', async () => {
    server.use(http.post(MCP_URL, () => HttpResponse.error()));

    const result = await zendropClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Zendrop MCP injoignable/);
    expect(result.error).toContain(MCP_URL);
  });

  it('returns an explicit message when MCP endpoint answers 200 with non-JSON body', async () => {
    server.use(
      http.post(MCP_URL, () => HttpResponse.text('<html>Cloudflare challenge</html>', { status: 200 })),
    );

    const result = await zendropClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/réponse inattendue/);
    expect(result.error).toMatch(/non-JSON/);
    expect(result.error).toMatch(/Cloudflare challenge/);
  });
});

// ---------------------------------------------------------------------------
// 3. Missing token → needsAuth:true
// ---------------------------------------------------------------------------

describe('zendropClient — missing token', () => {
  it('searchProducts returns needsAuth:true when no token in DB', async () => {
    dbScenario = 'noToken';

    const result = await zendropClient.searchProducts({ keywords: 'anything' });

    expect(result.success).toBe(false);
    expect(result.needsAuth).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('searchProducts returns an actionable error message when no token in DB (no more "unknown")', async () => {
    dbScenario = 'noToken';

    const result = await zendropClient.searchProducts({ keywords: 'anything' });

    // The registry renders `zendrop: ${error ?? 'unknown'}` — error MUST be set
    // and tell the operator exactly what to do.
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/Zendrop non connecté/);
    expect(result.error).toMatch(/platform_settings/);
    expect(result.error).toMatch(/OAuth/);
    expect(result.error).toContain('/api/zendrop/oauth/start');
  });

  it('placeOrder returns error when no token', async () => {
    dbScenario = 'noToken';

    const result = await zendropClient.placeOrder!({
      outOrderId: 'ord-1',
      address: {
        fullName: 'Test',
        contactPerson: 'Test',
        address1: '1 St',
        city: 'Paris',
        province: 'IDF',
        countryCode: 'FR',
        zip: '75001',
        phoneDial: '33',
        phoneNumber: '0600000000',
      },
      items: [{ externalId: 'zd-prod-001', quantity: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Zendrop non connecté/);
    expect(result.error).toContain('/api/zendrop/oauth/start');
  });

  it('ensureAuth returns false when no token', async () => {
    dbScenario = 'noToken';
    const ok = await zendropClient.ensureAuth!();
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. placeOrder — maps address + items, returns supplierOrderId
// ---------------------------------------------------------------------------

describe('zendropClient.placeOrder', () => {
  it('maps address and items correctly and returns supplierOrderId', async () => {
    let capturedArgs: unknown = null;

    server.use(
      http.post(MCP_URL, async ({ request }) => {
        const body = (await request.json()) as {
          params: { name: string; arguments: unknown };
        };
        if (body.params.name === 'create_order') {
          capturedArgs = body.params.arguments;
          return HttpResponse.json({
            jsonrpc: '2.0',
            id: 2,
            result: { order_id: 'zd-ord-999', success: true },
          });
        }
        return HttpResponse.json({ jsonrpc: '2.0', id: 2, error: { code: -1, message: 'unexpected tool' } });
      }),
    );

    const result = await zendropClient.placeOrder!({
      outOrderId: 'out-ord-42',
      address: {
        fullName: 'Marie Curie',
        contactPerson: 'Marie Curie',
        address1: '1 Lab Street',
        address2: 'Building B',
        city: 'Paris',
        province: 'Île-de-France',
        countryCode: 'FR',
        zip: '75005',
        phoneDial: '33',
        phoneNumber: '0611223344',
      },
      items: [
        { externalId: 'zd-prod-001', quantity: 2 },
        { externalId: 'zd-prod-002', quantity: 1 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.supplierOrderId).toBe('zd-ord-999');

    const args = capturedArgs as {
      reference_id: string;
      shipping_address: Record<string, unknown>;
      items: Array<{ product_id: string; quantity: number }>;
    };
    expect(args.reference_id).toBe('out-ord-42');
    expect(args.shipping_address.full_name).toBe('Marie Curie');
    expect(args.shipping_address.country_code).toBe('FR');
    expect(args.shipping_address.zip).toBe('75005');
    expect(args.shipping_address.address2).toBe('Building B');
    expect(args.items).toHaveLength(2);
    expect(args.items[0]).toEqual({ product_id: 'zd-prod-001', quantity: 2 });
    expect(args.items[1]).toEqual({ product_id: 'zd-prod-002', quantity: 1 });
  });

  it('returns success:false when create_order tool returns no order_id', async () => {
    server.use(
      http.post(MCP_URL, () =>
        HttpResponse.json({
          jsonrpc: '2.0',
          id: 2,
          result: { success: true },
          // no order_id — edge case from the MCP spec
        }),
      ),
    );

    const result = await zendropClient.placeOrder!({
      outOrderId: 'out-ord-err',
      address: {
        fullName: 'X',
        contactPerson: 'X',
        address1: '1',
        city: 'X',
        province: 'X',
        countryCode: 'US',
        zip: '0',
        phoneDial: '1',
        phoneNumber: '0',
      },
      items: [{ externalId: 'zd-1', quantity: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no order_id/);
  });
});

// ---------------------------------------------------------------------------
// 5. Token refresh: expired token triggers POST to token URL, new token used
// ---------------------------------------------------------------------------

describe('zendropClient — token refresh', () => {
  it('fetches a new access token when stored token is expired', async () => {
    dbScenario = 'expiredToken';

    // The token endpoint returns a fresh token
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.json({
          access_token: 'zd-new-access-token',
          refresh_token: 'zd-new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      ),
    );

    // MCP endpoint records the Authorization header
    let usedToken: string | null = null;
    server.use(
      http.post(MCP_URL, ({ request }) => {
        usedToken = request.headers.get('Authorization');
        return HttpResponse.json({
          jsonrpc: '2.0',
          id: 1,
          result: { products: [], total: 0 },
        });
      }),
    );

    const result = await zendropClient.searchProducts({ keywords: 'test refresh' });

    // The MCP call should have used the NEW token
    expect(usedToken).toBe('Bearer zd-new-access-token');
    expect(result.success).toBe(true);
  });

  it('returns needsAuth:true when refresh token call fails', async () => {
    dbScenario = 'expiredToken';

    server.use(
      http.post(TOKEN_URL, () => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })),
    );

    const result = await zendropClient.searchProducts({ keywords: 'refresh fail' });

    expect(result.success).toBe(false);
    expect(result.needsAuth).toBe(true);
  });

  it('explains WHY the refresh failed (expired token + token endpoint status)', async () => {
    dbScenario = 'expiredToken';

    server.use(
      http.post(TOKEN_URL, () => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })),
    );

    const result = await zendropClient.searchProducts({ keywords: 'refresh fail' });

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/token OAuth expiré/);
    expect(result.error).toMatch(/token endpoint HTTP 400/);
    expect(result.error).toContain('/api/zendrop/oauth/start');
  });

  it('explains missing OAuth client credentials when refresh is needed without them', async () => {
    dbScenario = 'expiredToken';
    vi.stubEnv('SUPPLIER_ZENDROP_CLIENT_ID', '');
    vi.stubEnv('SUPPLIER_ZENDROP_CLIENT_SECRET', '');

    const result = await zendropClient.searchProducts({ keywords: 'no creds' });

    expect(result.success).toBe(false);
    expect(result.needsAuth).toBe(true);
    expect(result.error).toMatch(/SUPPLIER_ZENDROP_CLIENT_ID/);
    expect(result.error).toMatch(/token OAuth expiré/);
  });
});

// ---------------------------------------------------------------------------
// 6. getTracking
// ---------------------------------------------------------------------------

describe('zendropClient.getTracking', () => {
  it('returns trackingNumber and carrier from MCP response', async () => {
    server.use(
      http.post(MCP_URL, async ({ request }) => {
        const body = (await request.json()) as { params: { name: string; arguments: { order_id: string } } };
        if (body.params.name === 'get_order_tracking' && body.params.arguments.order_id === 'zd-ord-track-1') {
          return HttpResponse.json({
            jsonrpc: '2.0',
            id: 3,
            result: {
              tracking_number: 'ZD-TRACK-456',
              carrier: 'DHL',
              status: 'In Transit',
            },
          });
        }
        return HttpResponse.json({ jsonrpc: '2.0', id: 3, error: { code: -1, message: 'wrong tool/order' } });
      }),
    );

    const result = await zendropClient.getTracking!('zd-ord-track-1');

    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe('ZD-TRACK-456');
    expect(result.carrier).toBe('DHL');
    expect(result.status).toBe('In Transit');
  });

  it('returns success:false when not authenticated', async () => {
    dbScenario = 'noToken';
    const result = await zendropClient.getTracking!('any');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Zendrop non connecté/);
    expect(result.error).toContain('/api/zendrop/oauth/start');
  });
});

// ---------------------------------------------------------------------------
// 7. Client metadata
// ---------------------------------------------------------------------------

describe('zendropClient metadata', () => {
  it('has correct id, status, tier, and capabilities', () => {
    expect(zendropClient.id).toBe('zendrop');
    expect(zendropClient.label).toBe('Zendrop');
    expect(zendropClient.tier).toBe('v1');
    // `search_only`, not `active`: this is the unverified OAuth2+PKCE variant
    // that the registry does NOT wire in (it uses ./zendrop-connector). Nothing
    // here has proven it can forward a real order, so it must not advertise
    // fulfillment readiness.
    expect(zendropClient.status).toBe('search_only');
    expect(zendropClient.capabilities.unitOrder).toBe(true);
    expect(zendropClient.capabilities.noStock).toBe(true);
    expect(zendropClient.capabilities.directShip).toBe(true);
    expect(zendropClient.capabilities.neutralPackaging).toBe(true);
    expect(zendropClient.capabilities.stockPriceSync).toBe(true);
    expect(zendropClient.capabilities.tracking).toBe(true);
    expect(zendropClient.capabilities.returns).toBe(true);
    expect(zendropClient.capabilities.imageRights).toBe(false);
    expect(typeof zendropClient.placeOrder).toBe('function');
    expect(typeof zendropClient.getTracking).toBe('function');
    expect(typeof zendropClient.ensureAuth).toBe('function');
  });
});
