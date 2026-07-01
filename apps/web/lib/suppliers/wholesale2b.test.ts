/**
 * Vitest unit tests for the Wholesale2B supplier client.
 *
 * Wholesale2B is feed-only: searchProducts reads dropship_supplier_catalog
 * via getDbRead(). The DB is mocked in-memory. Tests cover:
 *   1. searchProducts reads from the catalog mock (rows → RawProduct[])
 *   2. Keyword filtering is forwarded to the DB query
 *   3. Missing catalog table returns graceful error
 *   4. placeOrder is undefined (feed-only contract)
 *   5. Client shape (id, tier, status, capabilities)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// DB mock
// ---------------------------------------------------------------------------

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

let mockQueryFn: QueryFn = async () => ({ rows: [], rowCount: 0 });

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: (sql: string, params?: unknown[]) => mockQueryFn(sql, params) }),
  getDbRead: () => ({ query: (sql: string, params?: unknown[]) => mockQueryFn(sql, params) }),
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const CATALOG_ROWS = [
  {
    external_id: 'W2B-001',
    title: 'Wireless Bluetooth Earbuds',
    price_eur: 18.5,
    image_url: 'https://cdn.w2b.com/earbuds.jpg',
    supplier_url: 'https://www.wholesale2b.com/p/W2B-001',
    weight_grams: 80,
    total: '2',
  },
  {
    external_id: 'W2B-002',
    title: 'USB-C Fast Charger 65W',
    price_eur: 12.99,
    image_url: 'https://cdn.w2b.com/charger.jpg',
    supplier_url: 'https://www.wholesale2b.com/p/W2B-002',
    weight_grams: null,
    total: '2',
  },
];

beforeEach(() => {
  vi.stubEnv('W2B_API_KEY', 'test-w2b-key');
  // Default: catalog returns rows
  mockQueryFn = async () => ({ rows: CATALOG_ROWS, rowCount: CATALOG_ROWS.length });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wholesale2bClient.searchProducts', () => {
  it('returns RawProduct[] from catalog', async () => {
    const { wholesale2bClient } = await import('./wholesale2b');
    const result = await wholesale2bClient.searchProducts({ keywords: 'wireless' });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);

    const product = result.products[0]!;
    expect(product.supplier).toBe('wholesale2b');
    expect(product.externalId).toBe('W2B-001');
    expect(product.title).toBe('Wireless Bluetooth Earbuds');
    expect(product.price).toBeCloseTo(18.5);
    expect(product.imageUrl).toBe('https://cdn.w2b.com/earbuds.jpg');
    expect(product.supplierUrl).toBe('https://www.wholesale2b.com/p/W2B-001');
    expect(product.weightGrams).toBe(80);
  });

  it('returns weightGrams as undefined when null in DB', async () => {
    const { wholesale2bClient } = await import('./wholesale2b');
    const result = await wholesale2bClient.searchProducts({ keywords: 'charger' });

    const charger = result.products.find((p) => p.externalId === 'W2B-002');
    expect(charger).toBeDefined();
    expect(charger!.weightGrams).toBeUndefined();
  });

  it('passes keyword as LIKE param to DB', async () => {
    const capturedParams: unknown[][] = [];
    mockQueryFn = async (_sql: string, params?: unknown[]) => {
      capturedParams.push(params ?? []);
      return { rows: [], rowCount: 0 };
    };

    const { wholesale2bClient } = await import('./wholesale2b');
    await wholesale2bClient.searchProducts({ keywords: 'earbuds', pageSize: 10 });

    expect(capturedParams.length).toBeGreaterThan(0);
    const firstParams = capturedParams[0]!;
    // keyword becomes %earbuds% in LIKE param position
    expect(firstParams).toContain('%earbuds%');
    // supplier param
    expect(firstParams).toContain('wholesale2b');
  });

  it('returns total from COUNT(*) OVER()', async () => {
    const { wholesale2bClient } = await import('./wholesale2b');
    const result = await wholesale2bClient.searchProducts({ keywords: 'usb' });

    expect(result.total).toBe(2);
  });

  it('returns success:true with empty array when no rows found', async () => {
    mockQueryFn = async () => ({ rows: [], rowCount: 0 });
    const { wholesale2bClient } = await import('./wholesale2b');
    const result = await wholesale2bClient.searchProducts({ keywords: 'nomatch' });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns catalog-not-ingested error when table is missing', async () => {
    mockQueryFn = async () => {
      throw new Error('relation "dropship_supplier_catalog" does not exist');
    };
    const { wholesale2bClient } = await import('./wholesale2b');
    const result = await wholesale2bClient.searchProducts({ keywords: 'anything' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not ingested/i);
  });

  it('returns DB error message on other DB failures', async () => {
    mockQueryFn = async () => {
      throw new Error('connection refused');
    };
    const { wholesale2bClient } = await import('./wholesale2b');
    const result = await wholesale2bClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/DB error/i);
  });
});

describe('wholesale2bClient — feed-only contract', () => {
  it('placeOrder is undefined', async () => {
    const { wholesale2bClient } = await import('./wholesale2b');
    expect(wholesale2bClient.placeOrder).toBeUndefined();
  });

  it('has correct id, tier, status', async () => {
    const { wholesale2bClient } = await import('./wholesale2b');
    expect(wholesale2bClient.id).toBe('wholesale2b');
    expect(wholesale2bClient.tier).toBe('v2');
    expect(wholesale2bClient.status).toBe('feed-only');
  });

  it('has all 8 capabilities as booleans', async () => {
    const { wholesale2bClient } = await import('./wholesale2b');
    const caps = wholesale2bClient.capabilities;
    const keys = ['unitOrder', 'noStock', 'directShip', 'neutralPackaging', 'stockPriceSync', 'tracking', 'returns', 'imageRights'] as const;
    for (const k of keys) {
      expect(typeof caps[k]).toBe('boolean');
    }
  });
});
