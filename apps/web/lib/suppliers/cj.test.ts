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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup-msw';
import { cjClient, __resetCjAuthCache } from './cj';

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
