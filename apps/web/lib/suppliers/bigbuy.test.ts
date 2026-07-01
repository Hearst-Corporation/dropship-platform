/**
 * Vitest unit tests for the BigBuy supplier client.
 *
 * MSW mocks intercept HTTP calls to api.bigbuy.eu. The DB is not used by
 * BigBuy (static auth + external catalog). Tests cover:
 *   1. searchProducts → RawProduct[] shape
 *   2. placeOrder: check → create → supplierOrderId
 *   3. 401 auth error → needsAuth
 *   4. Missing env key → needsAuth / fail-closed
 *   5. getTracking → TrackingResult shape
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const PRODUCTS_RESPONSE = [
  {
    id: 123,
    sku: 'BB-SKU-001',
    name: 'Premium Wireless Headphones',
    wholesalePrice: 29.99,
    weight: 320,
  },
  {
    id: 456,
    sku: 'BB-SKU-002',
    name: 'Smart Watch Pro',
    wholesalePrice: 49.99,
    weight: 85,
  },
];

const IMAGES_RESPONSE_123 = [
  { id: 1, url: 'https://cdn.bigbuy.eu/img/headphones.jpg', position: 1 },
];
const IMAGES_RESPONSE_456 = [
  { id: 2, url: 'https://cdn.bigbuy.eu/img/watch.jpg', position: 1 },
];

const CARRIERS_RESPONSE = [{ id: 7, name: 'Standard', shippingCost: 3.5 }];

const server = setupServer(
  // catalog/products.json
  http.get('https://api.bigbuy.eu/rest/catalog/products.json', () => {
    return HttpResponse.json(PRODUCTS_RESPONSE);
  }),
  // product images — id 123
  http.get('https://api.bigbuy.eu/rest/catalog/productimages/123.json', () => {
    return HttpResponse.json(IMAGES_RESPONSE_123);
  }),
  // product images — id 456
  http.get('https://api.bigbuy.eu/rest/catalog/productimages/456.json', () => {
    return HttpResponse.json(IMAGES_RESPONSE_456);
  }),
  // carriers
  http.get('https://api.bigbuy.eu/rest/order/carriers/new.json', () => {
    return HttpResponse.json(CARRIERS_RESPONSE);
  }),
  // order check
  http.post('https://api.bigbuy.eu/rest/order/check.json', () => {
    return HttpResponse.json({ ok: true }, { status: 200 });
  }),
  // order create
  http.post('https://api.bigbuy.eu/rest/order/create.json', () => {
    return HttpResponse.json({ order: { id: 'BB-ORDER-9876' } }, { status: 200 });
  }),
  // tracking
  http.get('https://api.bigbuy.eu/rest/tracking/order/BB-ORDER-9876.json', () => {
    return HttpResponse.json({
      trackingNumber: 'TRACK123456FR',
      carrier: 'Colissimo',
      status: 'in_transit',
    });
  }),
);

beforeEach(() => {
  vi.stubEnv('BIGBUY_API_KEY', 'test-bigbuy-key');
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
  server.close();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bigbuyClient.searchProducts', () => {
  it('returns RawProduct[] with correct shape', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.searchProducts({ keywords: 'premium' });

    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);

    const product = result.products[0]!;
    expect(product.supplier).toBe('bigbuy');
    expect(typeof product.externalId).toBe('string');
    expect(product.externalId).toBeTruthy();
    expect(typeof product.title).toBe('string');
    expect(typeof product.price).toBe('number');
    expect(product.price).toBeGreaterThan(0);
    expect(typeof product.imageUrl).toBe('string');
    expect(typeof product.supplierUrl).toBe('string');
  });

  it('maps wholesalePrice to price (EUR)', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.searchProducts({ keywords: 'headphones' });

    expect(result.success).toBe(true);
    const product = result.products.find((p) => p.externalId === 'BB-SKU-001');
    expect(product).toBeDefined();
    expect(product!.price).toBeCloseTo(29.99);
  });

  it('picks first image as imageUrl', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.searchProducts({ keywords: 'headphones' });

    const product = result.products.find((p) => p.externalId === 'BB-SKU-001');
    expect(product?.imageUrl).toBe('https://cdn.bigbuy.eu/img/headphones.jpg');
  });

  it('includes weightGrams when present', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.searchProducts({ keywords: 'wireless' });

    const product = result.products.find((p) => p.externalId === 'BB-SKU-001');
    expect(product?.weightGrams).toBe(320);
  });

  it('returns empty products when keyword matches nothing', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.searchProducts({ keywords: 'zzznomatchzzz' });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('excludes products with no resolvable price (not emitted at price 0)', async () => {
    // Override the products endpoint to return one normal product and one
    // with no price fields set (all undefined → extractPrice returns null).
    server.use(
      http.get('https://api.bigbuy.eu/rest/catalog/products.json', () => {
        return HttpResponse.json([
          {
            id: 123,
            sku: 'BB-SKU-001',
            name: 'Premium Wireless Headphones',
            wholesalePrice: 29.99,
            weight: 320,
          },
          {
            id: 789,
            sku: 'BB-SKU-NO-PRICE',
            name: 'Priceless Widget',
            // wholesalePrice / retailPrice / taxIncludedPrice all absent
            weight: 50,
          },
        ]);
      }),
      http.get('https://api.bigbuy.eu/rest/catalog/productimages/789.json', () => {
        return HttpResponse.json([]);
      }),
    );

    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.searchProducts({ keywords: 'widget headphones' });

    expect(result.success).toBe(true);
    // Only the priced product should appear — no-price product dropped
    const skus = result.products.map((p) => p.externalId);
    expect(skus).not.toContain('BB-SKU-NO-PRICE');
    // No product should have price 0
    for (const p of result.products) {
      expect(p.price).toBeGreaterThan(0);
    }
  });

  it('returns needsAuth when api key is missing', async () => {
    vi.stubEnv('BIGBUY_API_KEY', '');
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.needsAuth).toBe(true);
  });

  it('returns needsAuth on 401 from API', async () => {
    server.use(
      http.get('https://api.bigbuy.eu/rest/catalog/products.json', () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }),
    );
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.needsAuth).toBe(true);
  });
});

describe('bigbuyClient.placeOrder', () => {
  const ORDER_INPUT = {
    outOrderId: 'our-order-abc123',
    address: {
      fullName: 'Marie Dupont',
      contactPerson: 'Marie Dupont',
      address1: '12 Rue de la Paix',
      city: 'Paris',
      province: 'Île-de-France',
      countryCode: 'FR',
      zip: '75001',
      phoneDial: '33',
      phoneNumber: '612345678',
    },
    items: [{ externalId: 'BB-SKU-001', quantity: 2 }],
  };

  it('executes check then create and returns supplierOrderId', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.placeOrder!(ORDER_INPUT);

    expect(result.success).toBe(true);
    expect(result.supplierOrderId).toBe('BB-ORDER-9876');
    expect(result.raw).toBeDefined();
  });

  it('fails closed when order check returns an error', async () => {
    server.use(
      http.post('https://api.bigbuy.eu/rest/order/check.json', () => {
        return HttpResponse.json({ error: 'Out of stock' }, { status: 400 });
      }),
    );
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.placeOrder!(ORDER_INPUT);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('fails closed when API key missing', async () => {
    vi.stubEnv('BIGBUY_API_KEY', '');
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.placeOrder!(ORDER_INPUT);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/BIGBUY_API_KEY/i);
  });
});

describe('bigbuyClient.getTracking', () => {
  it('returns tracking info', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.getTracking!('BB-ORDER-9876');

    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe('TRACK123456FR');
    expect(result.carrier).toBe('Colissimo');
    expect(result.status).toBe('in_transit');
  });

  it('returns error on tracking failure', async () => {
    server.use(
      http.get('https://api.bigbuy.eu/rest/tracking/order/BB-ORDER-9876.json', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      }),
    );
    const { bigbuyClient } = await import('./bigbuy');
    const result = await bigbuyClient.getTracking!('BB-ORDER-9876');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('bigbuyClient shape', () => {
  it('has correct id, tier, status', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    expect(bigbuyClient.id).toBe('bigbuy');
    expect(bigbuyClient.tier).toBe('v2');
    expect(bigbuyClient.status).toBe('active');
  });

  it('has all 8 capabilities set to true', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    const caps = bigbuyClient.capabilities;
    expect(caps.unitOrder).toBe(true);
    expect(caps.noStock).toBe(true);
    expect(caps.directShip).toBe(true);
    expect(caps.neutralPackaging).toBe(true);
    expect(caps.stockPriceSync).toBe(true);
    expect(caps.tracking).toBe(true);
    expect(caps.returns).toBe(true);
    expect(caps.imageRights).toBe(true);
  });

  it('exposes placeOrder and getTracking (active status)', async () => {
    const { bigbuyClient } = await import('./bigbuy');
    expect(typeof bigbuyClient.placeOrder).toBe('function');
    expect(typeof bigbuyClient.getTracking).toBe('function');
  });
});
