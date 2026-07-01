/**
 * Vitest unit tests for the Doba supplier client.
 *
 * MSW mocks intercept HTTP calls to open.doba.com. Tests cover:
 *   1. searchProducts → RawProduct[] shape
 *   2. Auth failure (401/403) → needsAuth
 *   3. Missing env vars → needsAuth
 *   4. API error code → error message
 *   5. placeOrder is undefined (feed-only pending confirmation)
 *   6. Client shape (id, tier, status, capabilities)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const SEARCH_RESPONSE = {
  code: 0,
  data: {
    total: 2,
    products: [
      {
        productId: 'DOBA-1001',
        name: 'LED Desk Lamp Adjustable',
        imageUrl: 'https://img.doba.com/lamp.jpg',
        price: 22.5,
        productUrl: 'https://www.doba.com/item/DOBA-1001',
        weightGrams: 540,
      },
      {
        productId: 'DOBA-1002',
        name: 'Bamboo Cutting Board Set',
        imageUrl: 'https://img.doba.com/board.jpg',
        price: 14.75,
        productUrl: 'https://www.doba.com/item/DOBA-1002',
        weightGrams: 720,
      },
    ],
  },
};

const server = setupServer(
  http.post('https://open.doba.com/api/product/search', () => {
    return HttpResponse.json(SEARCH_RESPONSE);
  }),
);

beforeEach(() => {
  vi.stubEnv('DOBA_ACCESS_KEY', 'test-doba-access-key');
  vi.stubEnv('DOBA_SECRET', 'test-doba-secret');
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

describe('dobaClient.searchProducts', () => {
  it('returns RawProduct[] with correct shape', async () => {
    const { dobaClient } = await import('./doba');
    const result = await dobaClient.searchProducts({ keywords: 'led lamp' });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);

    const product = result.products[0]!;
    expect(product.supplier).toBe('doba');
    expect(typeof product.externalId).toBe('string');
    expect(product.externalId).toBeTruthy();
    expect(typeof product.title).toBe('string');
    expect(typeof product.price).toBe('number');
    expect(product.price).toBeGreaterThan(0);
    expect(typeof product.imageUrl).toBe('string');
    expect(typeof product.supplierUrl).toBe('string');
  });

  it('maps productId to externalId and price correctly', async () => {
    const { dobaClient } = await import('./doba');
    const result = await dobaClient.searchProducts({ keywords: 'lamp' });

    expect(result.success).toBe(true);
    const lamp = result.products.find((p) => p.externalId === 'DOBA-1001');
    expect(lamp).toBeDefined();
    expect(lamp!.price).toBeCloseTo(22.5);
    expect(lamp!.imageUrl).toBe('https://img.doba.com/lamp.jpg');
    expect(lamp!.weightGrams).toBe(540);
  });

  it('includes total from API response', async () => {
    const { dobaClient } = await import('./doba');
    const result = await dobaClient.searchProducts({ keywords: 'cutting board' });

    expect(result.total).toBe(2);
  });

  it('returns needsAuth when env vars are missing', async () => {
    vi.stubEnv('DOBA_ACCESS_KEY', '');
    vi.stubEnv('DOBA_SECRET', '');
    const { dobaClient } = await import('./doba');
    const result = await dobaClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.needsAuth).toBe(true);
  });

  it('returns needsAuth on 401 from API', async () => {
    server.use(
      http.post('https://open.doba.com/api/product/search', () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }),
    );
    const { dobaClient } = await import('./doba');
    const result = await dobaClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.needsAuth).toBe(true);
  });

  it('returns needsAuth on 403 from API', async () => {
    server.use(
      http.post('https://open.doba.com/api/product/search', () => {
        return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
      }),
    );
    const { dobaClient } = await import('./doba');
    const result = await dobaClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.needsAuth).toBe(true);
  });

  it('returns error message on non-zero API code', async () => {
    server.use(
      http.post('https://open.doba.com/api/product/search', () => {
        return HttpResponse.json({ code: 1001, message: 'Invalid keyword' });
      }),
    );
    const { dobaClient } = await import('./doba');
    const result = await dobaClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid keyword/i);
  });

  it('returns empty products when API returns empty list', async () => {
    server.use(
      http.post('https://open.doba.com/api/product/search', () => {
        return HttpResponse.json({ code: 0, data: { total: 0, products: [] } });
      }),
    );
    const { dobaClient } = await import('./doba');
    const result = await dobaClient.searchProducts({ keywords: 'zzznomatch' });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe('dobaClient — feed-only contract', () => {
  it('placeOrder is undefined', async () => {
    const { dobaClient } = await import('./doba');
    expect(dobaClient.placeOrder).toBeUndefined();
  });

  it('has correct id, tier, status', async () => {
    const { dobaClient } = await import('./doba');
    expect(dobaClient.id).toBe('doba');
    expect(dobaClient.tier).toBe('v2');
    expect(dobaClient.status).toBe('feed-only');
  });

  it('has all 8 capabilities as booleans', async () => {
    const { dobaClient } = await import('./doba');
    const caps = dobaClient.capabilities;
    const keys = ['unitOrder', 'noStock', 'directShip', 'neutralPackaging', 'stockPriceSync', 'tracking', 'returns', 'imageRights'] as const;
    for (const k of keys) {
      expect(typeof caps[k]).toBe('boolean');
    }
  });
});
