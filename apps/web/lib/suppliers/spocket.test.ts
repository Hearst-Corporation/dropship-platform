/**
 * Spocket supplier client tests.
 *
 * NOTE: The Spocket catalog API endpoint used here is provisional.
 * See // CONFIRM markers in spocket.ts. Update the MSW handler URL when the
 * real endpoint is confirmed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup-msw';
import { spocketClient } from './spocket';
import { getUsdEurRate } from './fx';

// ---------------------------------------------------------------------------
// MSW handler helpers
// ---------------------------------------------------------------------------

/** Spocket catalog search success response. */
function spocketSearchSuccess() {
  return http.get('https://app.spocket.co/api/v1/products/search', () => {
    return HttpResponse.json({
      products: [
        {
          id: 'sp-001',
          title: 'Premium Wireless Earbuds',
          price: 18.5,
          thumbnail_url: 'https://cdn.spocket.co/images/earbuds.jpg',
          url: 'https://app.spocket.co/products/sp-001',
          weight: 120,
        },
        {
          id: 'sp-002',
          title: 'Portable Bluetooth Speaker',
          price: 24.99,
          thumbnail_url: 'https://cdn.spocket.co/images/speaker.jpg',
          url: 'https://app.spocket.co/products/sp-002',
        },
      ],
      total_count: 2,
    });
  });
}

/** Spocket catalog search — empty results. */
function spocketSearchEmpty() {
  return http.get('https://app.spocket.co/api/v1/products/search', () => {
    return HttpResponse.json({ products: [], total_count: 0 });
  });
}

/** Spocket API HTTP error. */
function spocketSearchError(status = 500) {
  return http.get('https://app.spocket.co/api/v1/products/search', () => {
    return new HttpResponse(null, { status });
  });
}

// ---------------------------------------------------------------------------
// Tests: no API key configured
// ---------------------------------------------------------------------------

describe('spocketClient — no API key', () => {
  beforeEach(() => {
    vi.stubEnv('SUPPLIER_SPOCKET_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('searchProducts returns success:false with unavailable error', async () => {
    const result = await spocketClient.searchProducts({ keywords: 'earbuds' });
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
    expect(result.error).toMatch(/unavailable|catalog-only|manual fulfillment/i);
  });

  it('does not make any HTTP request when key is absent', async () => {
    // If a request were made without a handler, MSW would throw (onUnhandledRequest: 'error').
    await expect(
      spocketClient.searchProducts({ keywords: 'test' }),
    ).resolves.toMatchObject({ success: false, products: [] });
  });
});

// ---------------------------------------------------------------------------
// Tests: API key present — successful search
// ---------------------------------------------------------------------------

describe('spocketClient — with API key, successful search', () => {
  beforeEach(() => {
    vi.stubEnv('SUPPLIER_SPOCKET_API_KEY', 'test-spocket-key-abc');
    server.use(spocketSearchSuccess());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('searchProducts returns success:true', async () => {
    const result = await spocketClient.searchProducts({ keywords: 'earbuds' });
    expect(result.success).toBe(true);
  });

  it('maps products to RawProduct shape', async () => {
    const result = await spocketClient.searchProducts({ keywords: 'earbuds' });
    expect(result.products).toHaveLength(2);

    const first = result.products[0];
    // price is converted USD→EUR via usdToEur (default rate 0.92)
    expect(first?.supplier).toBe('spocket');
    expect(first?.externalId).toBe('sp-001');
    expect(first?.title).toBe('Premium Wireless Earbuds');
    expect(first?.price).toBeCloseTo(18.5 * getUsdEurRate(), 4);
    expect(first?.imageUrl).toBe('https://cdn.spocket.co/images/earbuds.jpg');
    expect(first?.supplierUrl).toBe('https://app.spocket.co/products/sp-001');
  });

  it('maps weightGrams when present', async () => {
    const result = await spocketClient.searchProducts({ keywords: 'earbuds' });
    expect(result.products[0]!.weightGrams).toBe(120);
  });

  it('weightGrams is undefined when not in API response', async () => {
    const result = await spocketClient.searchProducts({ keywords: 'earbuds' });
    expect(result.products[1]!.weightGrams).toBeUndefined();
  });

  it('surfaces total from API', async () => {
    const result = await spocketClient.searchProducts({ keywords: 'earbuds' });
    expect(result.total).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: API key present — empty results
// ---------------------------------------------------------------------------

describe('spocketClient — with API key, empty results', () => {
  beforeEach(() => {
    vi.stubEnv('SUPPLIER_SPOCKET_API_KEY', 'test-spocket-key-abc');
    server.use(spocketSearchEmpty());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns success:true with empty products array', async () => {
    const result = await spocketClient.searchProducts({ keywords: 'nothing' });
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: API key present — HTTP error
// ---------------------------------------------------------------------------

describe('spocketClient — with API key, HTTP error', () => {
  beforeEach(() => {
    vi.stubEnv('SUPPLIER_SPOCKET_API_KEY', 'test-spocket-key-abc');
    server.use(spocketSearchError(503));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns success:false with error message', async () => {
    const result = await spocketClient.searchProducts({ keywords: 'earbuds' });
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: placeOrder must be undefined (search_only)
// ---------------------------------------------------------------------------

describe('spocketClient — manifest assertions', () => {
  it('id is spocket', () => {
    expect(spocketClient.id).toBe('spocket');
  });

  it('status is search_only', () => {
    expect(spocketClient.status).toBe('search_only');
  });

  it('placeOrder is undefined (no headless order API)', () => {
    expect(spocketClient.placeOrder).toBeUndefined();
  });

  it('tier is v1', () => {
    expect(spocketClient.tier).toBe('v1');
  });

  it('all 8 capabilities are present and boolean', () => {
    const caps = spocketClient.capabilities;
    const keys = [
      'unitOrder', 'noStock', 'directShip', 'neutralPackaging',
      'stockPriceSync', 'tracking', 'returns', 'imageRights',
    ] as const;
    for (const k of keys) {
      expect(typeof caps[k]).toBe('boolean');
    }
  });
});
