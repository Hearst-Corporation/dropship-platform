/**
 * Unit tests for lib/automation/autods.ts
 *
 * Covered:
 * (a) routeOrderViaAutoDS — happy path: builds request, parses autodsOrderId
 * (b) routeOrderViaAutoDS — missing token → success:false + descriptive error
 * (c) routeOrderViaAutoDS — HTTP 403 from AutoDS → success:false + error message
 * (d) getAutoDSTracking — parses trackingNumber, carrier, status from response
 *
 * fetch is stubbed via vi.stubGlobal. DB is mocked via vi.mock('@/lib/db').
 * Default fetch mock returns 403 (fail-closed) so any uncovered call is caught.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// DB mock — return the autods_api_token row by default
// ---------------------------------------------------------------------------

let dbTokenRow: unknown[] = [
  { value: 'autods-plain-token', value_enc: null, value_nonce: null },
];

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    query: (_sql: string) => {
      // platform_settings lookup
      return Promise.resolve({ rows: dbTokenRow, rowCount: dbTokenRow.length });
    },
  }),
  getDbRead: () => ({
    query: (_sql: string) => Promise.resolve({ rows: [], rowCount: 0 }),
  }),
}));

// ---------------------------------------------------------------------------
// secrets mock — pass-through for plain text (value_enc=null path)
// ---------------------------------------------------------------------------

vi.mock('@/lib/secrets', () => ({
  tryDecryptSecret: (enc: unknown, _nonce: unknown) => {
    // value_enc is null in the default fixture → tryDecryptSecret returns null
    // → caller falls back to row.value
    if (!enc) return null;
    return 'decrypted-token';
  },
  encryptSecret: (plain: string) => ({
    encrypted: Buffer.from(plain),
    nonce: Buffer.from('123456789012'),
  }),
}));

// ---------------------------------------------------------------------------
// Global fetch stub — default: 403 fail-closed
// ---------------------------------------------------------------------------

function makeResponse(body: unknown, status = 200): Response {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(json, {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  // Reset env
  vi.stubEnv('AUTODS_API_URL', 'https://gw.autods.com');
  vi.stubEnv('AUTODS_BUYER_ACCOUNT_ID', 'buyer-acct-42');
  vi.stubEnv('AUTODS_ROUTING_ENABLED', '');

  // Default fetch: fail-closed 403
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => makeResponse({ error: 'unauthorized' }, 403)),
  );

  // Default: DB returns a token row
  dbTokenRow = [{ value: 'autods-plain-token', value_enc: null, value_nonce: null }];
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRouteInput() {
  return {
    outOrderId: 'order_medusa_001',
    underlyingSupplier: 'aliexpress',
    address: {
      fullName: 'Jean Dupont',
      contactPerson: 'Jean Dupont',
      address1: '10 rue de la Paix',
      address2: undefined,
      city: 'Paris',
      province: 'Île-de-France',
      countryCode: 'FR',
      zip: '75001',
      phoneDial: '33',
      phoneNumber: '612345678',
    },
    items: [
      { externalId: 'ae_product_999', quantity: 2, skuAttr: '14:175;5:100' },
    ],
  };
}

// ---------------------------------------------------------------------------
// (a) Happy path — builds request + parses autodsOrderId
// ---------------------------------------------------------------------------

describe('routeOrderViaAutoDS — happy path', () => {
  it('sends a POST with the correct Authorization header and returns autodsOrderId', async () => {
    const capturedRequest: { url: string; init: RequestInit }[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        capturedRequest.push({ url, init });
        return makeResponse({ order_id: 'autods-order-XYZ', status: 'pending' });
      }),
    );

    const { routeOrderViaAutoDS } = await import('./autods');
    const result = await routeOrderViaAutoDS(makeRouteInput());

    expect(result.success).toBe(true);
    expect(result.autodsOrderId).toBe('autods-order-XYZ');
    expect(result.error).toBeUndefined();

    // Check the request was built correctly
    expect(capturedRequest).toHaveLength(1);
    const req = capturedRequest[0]!;
    expect(req.url).toContain('autods.com');
    expect(req.url).toContain('auto-order');
    expect((req.init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer autods-plain-token',
    );

    // Body should include our order id and buyer account
    const body = JSON.parse(req.init.body as string);
    expect(body.external_order_id).toBe('order_medusa_001');
    expect(body.buyer_account_id).toBe('buyer-acct-42');
    expect(body.source).toBe('aliexpress');
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(2);
    expect(body.items[0].sku_attr).toBe('14:175;5:100');
  });

  it('falls back to data.id when order_id is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        makeResponse({ data: { id: 'nested-order-ABC' }, status: 'placed' }),
      ),
    );

    const { routeOrderViaAutoDS } = await import('./autods');
    const result = await routeOrderViaAutoDS(makeRouteInput());

    expect(result.success).toBe(true);
    expect(result.autodsOrderId).toBe('nested-order-ABC');
  });
});

// ---------------------------------------------------------------------------
// (b) Missing token → success:false + descriptive error
// ---------------------------------------------------------------------------

describe('routeOrderViaAutoDS — missing token', () => {
  it('returns error when autods_api_token is absent from platform_settings', async () => {
    dbTokenRow = []; // no row in DB

    const { routeOrderViaAutoDS } = await import('./autods');
    const result = await routeOrderViaAutoDS(makeRouteInput());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not configured/i);
    // fetch must NOT have been called
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('returns error when AUTODS_BUYER_ACCOUNT_ID env var is missing', async () => {
    vi.stubEnv('AUTODS_BUYER_ACCOUNT_ID', '');

    const { routeOrderViaAutoDS } = await import('./autods');
    const result = await routeOrderViaAutoDS(makeRouteInput());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/AUTODS_BUYER_ACCOUNT_ID/i);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// (c) HTTP 403 from AutoDS → success:false + error message
// ---------------------------------------------------------------------------

describe('routeOrderViaAutoDS — HTTP error', () => {
  it('returns success:false with AutoDS HTTP error message on 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeResponse({ message: 'Forbidden' }, 403)),
    );

    const { routeOrderViaAutoDS } = await import('./autods');
    const result = await routeOrderViaAutoDS(makeRouteInput());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/AutoDS HTTP 403/);
    expect(result.raw).toBeDefined();
  });

  it('returns success:false on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const { routeOrderViaAutoDS } = await import('./autods');
    const result = await routeOrderViaAutoDS(makeRouteInput());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to fetch/i);
  });
});

// ---------------------------------------------------------------------------
// (d) getAutoDSTracking — parses trackingNumber, carrier, status
// ---------------------------------------------------------------------------

describe('getAutoDSTracking', () => {
  it('parses tracking fields from a flat response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        makeResponse({
          tracking_number: '1Z999AA10123456784',
          carrier: 'UPS',
          status: 'in_transit',
        }),
      ),
    );

    const { getAutoDSTracking } = await import('./autods');
    const result = await getAutoDSTracking('autods-order-XYZ');

    expect(result.trackingNumber).toBe('1Z999AA10123456784');
    expect(result.carrier).toBe('UPS');
    expect(result.status).toBe('in_transit');
    expect(result.raw).toBeDefined();
  });

  it('parses tracking fields from a nested data response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        makeResponse({
          data: {
            tracking_number: 'JD014600004828290257',
            carrier: 'CAINIAO',
            status: 'delivered',
          },
        }),
      ),
    );

    const { getAutoDSTracking } = await import('./autods');
    const result = await getAutoDSTracking('autods-order-XYZ');

    expect(result.trackingNumber).toBe('JD014600004828290257');
    expect(result.carrier).toBe('CAINIAO');
    expect(result.status).toBe('delivered');
  });

  it('returns a status error string when token is missing', async () => {
    dbTokenRow = [];

    const { getAutoDSTracking } = await import('./autods');
    const result = await getAutoDSTracking('autods-order-XYZ');

    expect(result.trackingNumber).toBeUndefined();
    expect(result.status).toMatch(/token not configured/i);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
