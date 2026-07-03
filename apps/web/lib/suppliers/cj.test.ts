/**
 * CJ Dropshipping client — fulfillment unit tests.
 *
 * The global MSW server in test/setup-msw.ts defaults to auth-failure (the
 * CJ handler returns code 1600200 / result:false). Every test here that
 * needs a functioning auth+fulfillment path overrides via server.use().
 *
 * afterEach in setup-msw.ts calls server.resetHandlers(), so each test
 * starts clean.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup-msw';
import { cjClient, parseCjNumber, __resetCjAuthCache } from './cj';

// ---------------------------------------------------------------------------
// Helpers — MSW override factories
// ---------------------------------------------------------------------------

/** Makes CJ auth succeed (token = 'test-cj-token'). */
function mockCJAuth() {
  return http.post(
    'https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken',
    () =>
      HttpResponse.json({
        code: 200,
        result: true,
        data: { accessToken: 'test-cj-token' },
      }),
  );
}

/**
 * Makes the variant query succeed for the given pid, returning a single vid.
 * // CONFIRM: endpoint POST /product/variant/query with body { pid }.
 */
function mockVariantQuery(pid: string, vid: string) {
  return http.post(
    'https://developers.cjdropshipping.com/api2.0/v1/product/variant/query',
    async ({ request }) => {
      const body = (await request.json()) as { pid: string };
      if (body.pid !== pid) {
        return HttpResponse.json({ code: 404, result: false, message: 'not found' });
      }
      return HttpResponse.json({
        code: 200,
        result: true,
        data: { variants: [{ vid, variantNameEn: 'Default', variantSellPrice: 9.99 }] },
      });
    },
  );
}

/** Makes the variant query return zero variants (unresolvable). */
function mockVariantQueryEmpty() {
  return http.post(
    'https://developers.cjdropshipping.com/api2.0/v1/product/variant/query',
    () =>
      HttpResponse.json({ code: 200, result: true, data: { variants: [] } }),
  );
}

function mockCreateOrder(orderId: string) {
  return http.post(
    'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2',
    () =>
      HttpResponse.json({
        code: 200,
        result: true,
        data: { orderId, shipmentOrderId: orderId, cjPayUrl: `https://cj.com/pay/${orderId}` },
      }),
  );
}

function mockConfirmOrder() {
  return http.patch(
    'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/confirmOrder',
    () => HttpResponse.json({ code: 200, result: true }),
  );
}

function mockOrderDetail(orderId: string, trackNumber = 'TRACK123', provider = 'DHL', status = 'Shipped') {
  return http.get(
    'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail',
    ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('orderId') !== orderId) {
        return HttpResponse.json({ code: 404, result: false, message: 'not found' });
      }
      return HttpResponse.json({
        code: 200,
        result: true,
        data: { orderId, trackNumber, trackingProvider: provider, orderStatus: status },
      });
    },
  );
}

// ---------------------------------------------------------------------------
// Reset the module-level token cache before each test so auth is re-evaluated.
// ---------------------------------------------------------------------------

beforeEach(() => {
  // The token cache lives at module scope in cj.ts. Clear it so each test
  // re-authenticates against its own handlers instead of reusing a token
  // cached by a prior successful test.
  __resetCjAuthCache();
  vi.stubEnv('CJ_DROPSHIPPING_EMAIL', 'test@test.local');
  vi.stubEnv('CJ_DROPSHIPPING_API_KEY', 'test-cj-key');
});

// ---------------------------------------------------------------------------
// searchProducts — GET /product/list with productNameEn query param
// ---------------------------------------------------------------------------

describe('cjClient.searchProducts', () => {
  it('sends a GET with productNameEn/pageNum/pageSize and normalizes products', async () => {
    vi.stubEnv('SUPPLIER_USD_EUR_RATE', '0.92');
    let capturedUrl: URL | null = null;

    server.use(
      mockCJAuth(),
      http.get(
        'https://developers.cjdropshipping.com/api2.0/v1/product/list',
        ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json({
            code: 200,
            result: true,
            data: {
              total: 2,
              pageNum: 1,
              pageSize: 20,
              list: [
                {
                  pid: 'pid-1',
                  productNameEn: 'Aromatherapy Diffuser 500ml',
                  productImage: 'https://cf.cjdropshipping.com/img1.jpg',
                  productWeight: '150',
                  sellPrice: '13.00',
                  categoryId: 'cat-1',
                  categoryName: 'Home',
                  sourceFrom: '0',
                },
                {
                  // Range price + range weight, as the real API returns for
                  // multi-variant products.
                  pid: 'pid-2',
                  productNameEn: 'Essential Oil Diffuser Set',
                  productImage: 'https://cf.cjdropshipping.com/img2.jpg',
                  productWeight: '1730.00-3200.00',
                  sellPrice: '14.59 -- 24.05',
                  categoryId: 'cat-2',
                  categoryName: 'Home',
                  sourceFrom: '1',
                },
              ],
            },
          });
        },
      ),
    );

    const result = await cjClient.searchProducts({ keywords: 'aromatherapy diffuser' });

    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
    expect(capturedUrl!.searchParams.get('productNameEn')).toBe('aromatherapy diffuser');
    expect(capturedUrl!.searchParams.get('pageNum')).toBe('1');
    expect(capturedUrl!.searchParams.get('pageSize')).toBe('20');

    expect(result.products[0]).toMatchObject({
      supplier: 'cj',
      externalId: 'pid-1',
      title: 'Aromatherapy Diffuser 500ml',
      imageUrl: 'https://cf.cjdropshipping.com/img1.jpg',
      supplierUrl: 'https://www.cjdropshipping.com/product/-p-pid-1.html',
      weightGrams: 150,
    });
    // 13.00 USD * 0.92 = 11.96 EUR
    expect(result.products[0].price).toBeCloseTo(11.96, 2);

    // Range price → lower bound: 14.59 USD * 0.92 = 13.4228 EUR
    expect(result.products[1].price).toBeCloseTo(13.4228, 3);
    expect(result.products[1].weightGrams).toBe(1730);
  });

  it('retries once on the 1 req/s QPS limit (HTTP 429 / code 1600200)', async () => {
    let calls = 0;

    server.use(
      mockCJAuth(),
      http.get(
        'https://developers.cjdropshipping.com/api2.0/v1/product/list',
        () => {
          calls += 1;
          if (calls === 1) {
            return HttpResponse.json(
              { code: 1600200, result: false, message: 'Too Many Requests, QPS limit is 1 time/1second' },
              { status: 429 },
            );
          }
          return HttpResponse.json({
            code: 200,
            result: true,
            data: {
              total: 1,
              pageNum: 1,
              pageSize: 20,
              list: [
                {
                  pid: 'pid-retry',
                  productNameEn: 'Diffuser',
                  productImage: 'https://cf.cjdropshipping.com/img.jpg',
                  productWeight: '100',
                  sellPrice: '10.00',
                  categoryId: 'cat',
                  categoryName: 'Home',
                  sourceFrom: '0',
                },
              ],
            },
          });
        },
      ),
    );

    const result = await cjClient.searchProducts({ keywords: 'diffuser' });

    expect(calls).toBe(2);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].externalId).toBe('pid-retry');
  }, 10_000);

  it('returns success:false when CJ replies with a non-200 business code', async () => {
    server.use(
      mockCJAuth(),
      http.get(
        'https://developers.cjdropshipping.com/api2.0/v1/product/list',
        () =>
          HttpResponse.json({
            code: 16900202,
            result: false,
            message: "Request method 'POST' not supported",
          }),
      ),
    );

    const result = await cjClient.searchProducts({ keywords: 'diffuser' });

    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
    expect(result.error).toMatch(/not supported/);
  });
});

// ---------------------------------------------------------------------------
// parseCjNumber — price/weight string parsing
// ---------------------------------------------------------------------------

describe('parseCjNumber', () => {
  it('parses plain numbers, strings, and takes the lower bound of ranges', () => {
    expect(parseCjNumber(13)).toBe(13);
    expect(parseCjNumber('13.00')).toBe(13);
    expect(parseCjNumber('14.59 -- 24.05')).toBe(14.59);
    expect(parseCjNumber('1730.00-3200.00')).toBe(1730);
    expect(parseCjNumber('')).toBe(0);
    expect(parseCjNumber(null)).toBe(0);
    expect(parseCjNumber(undefined)).toBe(0);
    expect(parseCjNumber(NaN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// placeOrder — happy path: maps address + items + returns supplierOrderId
// ---------------------------------------------------------------------------

describe('cjClient.placeOrder — two-phase success', () => {
  it('resolves vid, creates order, confirms, and returns supplierOrderId', async () => {
    const pid = 'pid-abc';
    const vid = 'vid-xyz';
    const orderId = 'cj-order-999';

    server.use(
      mockCJAuth(),
      mockVariantQuery(pid, vid),
      mockCreateOrder(orderId),
      mockConfirmOrder(),
    );

    let createBody: Record<string, unknown> | null = null;
    server.use(
      http.post(
        'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2',
        async ({ request }) => {
          createBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            code: 200,
            result: true,
            data: { orderId, shipmentOrderId: orderId, cjPayUrl: `https://cj.com/pay/${orderId}` },
          });
        },
      ),
    );

    const result = await cjClient.placeOrder!({
      outOrderId: 'out-order-1',
      address: {
        fullName: 'Jean Dupont',
        contactPerson: 'Jean Dupont',
        address1: '12 Rue de la Paix',
        address2: 'Appt 3',
        city: 'Paris',
        province: 'Île-de-France',
        countryCode: 'FR',
        zip: '75001',
        phoneDial: '33',
        phoneNumber: '0612345678',
      },
      items: [{ externalId: pid, quantity: 2 }],
    });

    expect(result.success).toBe(true);
    expect(result.supplierOrderId).toBe(orderId);
    expect((result.raw as { create: unknown; confirm: unknown }).create).toBeTruthy();
    expect((result.raw as { create: unknown; confirm: unknown }).confirm).toBeTruthy();

    // Verify address mapping
    expect(createBody).toMatchObject({
      orderNumber: 'out-order-1',
      shippingCountryCode: 'FR',
      shippingZip: '75001',
      shippingCity: 'Paris',
      shippingProvince: 'Île-de-France',
      shippingCustomerName: 'Jean Dupont',
      shippingAddress: '12 Rue de la Paix',
      shippingAddress2: 'Appt 3',
      shippingPhone: '0612345678',
      products: [{ vid, quantity: 2 }],
    });
  });
});

// ---------------------------------------------------------------------------
// placeOrder — confirm failure: success:true + confirmed:false in raw
// ---------------------------------------------------------------------------

describe('cjClient.placeOrder — confirmOrder HTTP failure', () => {
  it('returns success:true, supplierOrderId, and raw.confirmed===false with error', async () => {
    const pid = 'pid-confirm-fail';
    const vid = 'vid-confirm-fail';
    const orderId = 'cj-order-confirm-err';

    server.use(
      mockCJAuth(),
      mockVariantQuery(pid, vid),
      mockCreateOrder(orderId),
      // confirmOrder fails with 503
      http.patch(
        'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/confirmOrder',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );

    const result = await cjClient.placeOrder!({
      outOrderId: 'out-confirm-fail',
      address: {
        fullName: 'Test User',
        contactPerson: 'Test User',
        address1: '1 Test St',
        city: 'Lyon',
        province: 'AuRA',
        countryCode: 'FR',
        zip: '69000',
        phoneDial: '33',
        phoneNumber: '0600000000',
      },
      items: [{ externalId: pid, quantity: 1 }],
    });

    expect(result.success).toBe(true);
    expect(result.supplierOrderId).toBe(orderId);
    const raw = result.raw as { confirmed: boolean; confirmError: string; create: unknown };
    expect(raw.confirmed).toBe(false);
    expect(typeof raw.confirmError).toBe('string');
    expect(raw.confirmError).toMatch(/503/);
  });
});

// ---------------------------------------------------------------------------
// placeOrder — variant unresolved → error, no order created
// ---------------------------------------------------------------------------

describe('cjClient.placeOrder — variant unresolved', () => {
  it('returns success:false with descriptive error when vid cannot be resolved', async () => {
    const pid = 'pid-unknown';

    server.use(mockCJAuth(), mockVariantQueryEmpty());

    const result = await cjClient.placeOrder!({
      outOrderId: 'out-order-2',
      address: {
        fullName: 'Test',
        contactPerson: 'Test',
        address1: '1 Test St',
        city: 'Lyon',
        province: 'AuRA',
        countryCode: 'FR',
        zip: '69000',
        phoneDial: '33',
        phoneNumber: '0600000000',
      },
      items: [{ externalId: pid, quantity: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cj variant unresolved for pid=pid-unknown/);
    expect(result.supplierOrderId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getTracking — parses trackNumber + carrier
// ---------------------------------------------------------------------------

describe('cjClient.getTracking', () => {
  it('returns trackingNumber and carrier from order detail', async () => {
    const orderId = 'cj-order-track-001';

    server.use(mockCJAuth(), mockOrderDetail(orderId, 'TRACK999', 'FedEx', 'Delivered'));

    const result = await cjClient.getTracking!(orderId);

    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe('TRACK999');
    expect(result.carrier).toBe('FedEx');
    expect(result.status).toBe('Delivered');
  });

  it('returns success:false when CJ returns a non-200 code', async () => {
    server.use(
      mockCJAuth(),
      http.get(
        'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail',
        () => HttpResponse.json({ code: 404, result: false, message: 'Order not found' }),
      ),
    );

    const result = await cjClient.getTracking!('does-not-exist');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Order not found/);
  });
});

// ---------------------------------------------------------------------------
// Auth failure — short-circuits before any order or tracking call
// ---------------------------------------------------------------------------

describe('cjClient — auth failure short-circuits', () => {
  it('placeOrder returns error when auth fails', async () => {
    // Default CJ handler in setup-msw already returns auth failure.
    // No override needed.
    const result = await cjClient.placeOrder!({
      outOrderId: 'out-order-fail',
      address: {
        fullName: 'X',
        contactPerson: 'X',
        address1: '1 X',
        city: 'X',
        province: 'X',
        countryCode: 'US',
        zip: '00000',
        phoneDial: '1',
        phoneNumber: '0000000000',
      },
      items: [{ externalId: 'pid-fail', quantity: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/CJ auth error|CJ auth failed/i);
  });

  it('getTracking returns error when auth fails', async () => {
    const result = await cjClient.getTracking!('any-order-id');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/CJ auth error|CJ auth failed/i);
  });

  it('searchProducts returns error when auth fails', async () => {
    const result = await cjClient.searchProducts({ keywords: 'yoga mat' });

    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Auth token cache TTL — derived from CJ's real expiry, not a fixed 1h
// ---------------------------------------------------------------------------
//
// We prove the effective expiry instant by counting authenticate() calls while
// advancing the clock with fake timers: the cached token is reused until the
// computed expiry passes, then a fresh auth POST is made. This exercises the
// real expiry math (expiry - 5min margin) vs the 1h fallback.

describe('cjClient — auth token cache TTL', () => {
  const MARGIN_MS = 5 * 60 * 1000; // must match TOKEN_REFRESH_MARGIN_MS in cj.ts
  const HOUR_MS = 3600 * 1000;

  /**
   * Serve a valid product/list once and count how many auth POSTs happened.
   * The auth handler can inject arbitrary expiry fields into data.data.
   */
  function wireAuthCounter(authExtra: Record<string, unknown>) {
    let authCalls = 0;
    server.use(
      http.post(
        'https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken',
        () => {
          authCalls += 1;
          return HttpResponse.json({
            code: 200,
            result: true,
            data: { accessToken: 'test-cj-token', ...authExtra },
          });
        },
      ),
      http.get(
        'https://developers.cjdropshipping.com/api2.0/v1/product/list',
        () =>
          HttpResponse.json({
            code: 200,
            result: true,
            data: { total: 0, pageNum: 1, pageSize: 20, list: [] },
          }),
      ),
    );
    return () => authCalls;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses CJ explicit expiry (absolute epoch ms) minus the safety margin', async () => {
    // CJ says the token expires 30 min from now → cache must refresh at
    // 30min - 5min margin = 25min, NOT at the 1h fallback.
    const expiryMs = Date.now() + 30 * 60 * 1000;
    const getAuthCalls = wireAuthCounter({ accessTokenExpiryDate: expiryMs });

    await cjClient.searchProducts({ keywords: 'a' });
    expect(getAuthCalls()).toBe(1);

    // Just before the derived expiry (25min - 1s): token still cached.
    vi.setSystemTime(new Date(expiryMs - MARGIN_MS - 1000));
    await cjClient.searchProducts({ keywords: 'a' });
    expect(getAuthCalls()).toBe(1);

    // Just after the derived expiry: re-authenticate.
    vi.setSystemTime(new Date(expiryMs - MARGIN_MS + 1000));
    await cjClient.searchProducts({ keywords: 'a' });
    expect(getAuthCalls()).toBe(2);

    // And this proves it is NOT the 1h fallback: at 40min (< 1h) we already
    // re-authed, whereas the fallback would still be valid.
    expect(expiryMs - MARGIN_MS).toBeLessThan(Date.now() /* now past 25min */);
  });

  it('honors a relative expiresIn (seconds) minus the margin', async () => {
    // expiresIn = 600s (10 min) → refresh at 10min - 5min = 5min.
    const getAuthCalls = wireAuthCounter({ expiresIn: 600 });
    const start = Date.now();

    await cjClient.searchProducts({ keywords: 'a' });
    expect(getAuthCalls()).toBe(1);

    vi.setSystemTime(new Date(start + 5 * 60 * 1000 - 1000)); // 4m59s
    await cjClient.searchProducts({ keywords: 'a' });
    expect(getAuthCalls()).toBe(1);

    vi.setSystemTime(new Date(start + 5 * 60 * 1000 + 1000)); // 5m01s
    await cjClient.searchProducts({ keywords: 'a' });
    expect(getAuthCalls()).toBe(2);
  });

  it('falls back to the 1h TTL when CJ returns no usable expiry field', async () => {
    const getAuthCalls = wireAuthCounter({}); // no expiry fields at all
    const start = Date.now();

    await cjClient.searchProducts({ keywords: 'a' });
    expect(getAuthCalls()).toBe(1);

    // At 59 min: still within the 1h fallback → cached.
    vi.setSystemTime(new Date(start + HOUR_MS - 60 * 1000));
    await cjClient.searchProducts({ keywords: 'a' });
    expect(getAuthCalls()).toBe(1);

    // At 1h + 1s: fallback expired → re-authenticate.
    vi.setSystemTime(new Date(start + HOUR_MS + 1000));
    await cjClient.searchProducts({ keywords: 'a' });
    expect(getAuthCalls()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Client metadata
// ---------------------------------------------------------------------------

describe('cjClient metadata', () => {
  it('has correct id, status, and capabilities', () => {
    expect(cjClient.id).toBe('cj');
    expect(cjClient.status).toBe('active');
    expect(cjClient.capabilities.unitOrder).toBe(true);
    expect(cjClient.capabilities.noStock).toBe(true);
    expect(cjClient.capabilities.directShip).toBe(true);
    expect(cjClient.capabilities.neutralPackaging).toBe(true);
    expect(cjClient.capabilities.tracking).toBe(true);
    expect(cjClient.capabilities.returns).toBe(false);
    expect(cjClient.capabilities.stockPriceSync).toBe(false);
    expect(typeof cjClient.placeOrder).toBe('function');
    expect(typeof cjClient.getTracking).toBe('function');
  });
});
