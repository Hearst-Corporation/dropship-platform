/**
 * Vitest unit tests for the Inventory Source supplier client.
 *
 * Inventory Source is feed-only: searchProducts reads dropship_supplier_catalog
 * via getDbRead(). Tests cover:
 *   1. searchProducts reads from the catalog mock (rows → RawProduct[])
 *   2. Missing catalog table returns graceful error
 *   3. placeOrder is undefined (feed-only contract)
 *   4. Client shape (id, tier, status, capabilities)
 *   5. imageRights is false (conservative default)
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
// Fixtures
// ---------------------------------------------------------------------------

const CATALOG_ROWS = [
  {
    external_id: 'IS-SKU-A1',
    title: 'Stainless Steel Water Bottle 32oz',
    price_eur: 15.99,
    image_url: 'https://cdn.inventorysource.com/bottle.jpg',
    supplier_url: 'https://www.inventorysource.com/p/IS-SKU-A1',
    weight_grams: 280,
    total: '3',
  },
  {
    external_id: 'IS-SKU-B2',
    title: 'Yoga Mat Non-Slip 6mm',
    price_eur: 24.5,
    image_url: 'https://cdn.inventorysource.com/yogamat.jpg',
    supplier_url: 'https://www.inventorysource.com/p/IS-SKU-B2',
    weight_grams: null,
    total: '3',
  },
  {
    external_id: 'IS-SKU-C3',
    title: 'Resistance Bands Set 5 Pack',
    price_eur: 11.25,
    image_url: 'https://cdn.inventorysource.com/bands.jpg',
    supplier_url: 'https://www.inventorysource.com/p/IS-SKU-C3',
    weight_grams: 150,
    total: '3',
  },
];

beforeEach(() => {
  vi.stubEnv('INVENTORY_SOURCE_API_KEY', 'test-is-key');
  mockQueryFn = async () => ({ rows: CATALOG_ROWS, rowCount: CATALOG_ROWS.length });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inventorySourceClient.searchProducts', () => {
  it('returns RawProduct[] from catalog', async () => {
    const { inventorySourceClient } = await import('./inventory-source');
    const result = await inventorySourceClient.searchProducts({ keywords: 'yoga' });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(3);

    const product = result.products[0]!;
    expect(product.supplier).toBe('inventory-source');
    expect(product.externalId).toBe('IS-SKU-A1');
    expect(product.title).toBe('Stainless Steel Water Bottle 32oz');
    expect(product.price).toBeCloseTo(15.99);
    expect(product.imageUrl).toBe('https://cdn.inventorysource.com/bottle.jpg');
    expect(product.supplierUrl).toBe('https://www.inventorysource.com/p/IS-SKU-A1');
    expect(product.weightGrams).toBe(280);
  });

  it('returns weightGrams as undefined when null in DB', async () => {
    const { inventorySourceClient } = await import('./inventory-source');
    const result = await inventorySourceClient.searchProducts({ keywords: 'mat' });

    const mat = result.products.find((p) => p.externalId === 'IS-SKU-B2');
    expect(mat).toBeDefined();
    expect(mat!.weightGrams).toBeUndefined();
  });

  it('passes supplier = inventory-source and keyword LIKE to DB', async () => {
    const capturedParams: unknown[][] = [];
    mockQueryFn = async (_sql: string, params?: unknown[]) => {
      capturedParams.push(params ?? []);
      return { rows: [], rowCount: 0 };
    };

    const { inventorySourceClient } = await import('./inventory-source');
    await inventorySourceClient.searchProducts({ keywords: 'resistance', pageSize: 10 });

    expect(capturedParams.length).toBeGreaterThan(0);
    const firstParams = capturedParams[0]!;
    expect(firstParams).toContain('inventory-source');
    expect(firstParams).toContain('%resistance%');
  });

  it('returns total from COUNT(*) OVER()', async () => {
    const { inventorySourceClient } = await import('./inventory-source');
    const result = await inventorySourceClient.searchProducts({ keywords: 'yoga' });

    expect(result.total).toBe(3);
  });

  it('returns success:true with empty array when no rows', async () => {
    mockQueryFn = async () => ({ rows: [], rowCount: 0 });
    const { inventorySourceClient } = await import('./inventory-source');
    const result = await inventorySourceClient.searchProducts({ keywords: 'nomatch' });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns catalog-not-ingested error when table is missing', async () => {
    mockQueryFn = async () => {
      throw new Error('relation "dropship_supplier_catalog" does not exist');
    };
    const { inventorySourceClient } = await import('./inventory-source');
    const result = await inventorySourceClient.searchProducts({ keywords: 'anything' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not ingested/i);
  });

  it('returns DB error message on other DB failures', async () => {
    mockQueryFn = async () => {
      throw new Error('timeout: connection pool exhausted');
    };
    const { inventorySourceClient } = await import('./inventory-source');
    const result = await inventorySourceClient.searchProducts({ keywords: 'test' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/DB error/i);
  });
});

describe('inventorySourceClient — feed-only contract', () => {
  it('placeOrder is undefined', async () => {
    const { inventorySourceClient } = await import('./inventory-source');
    expect(inventorySourceClient.placeOrder).toBeUndefined();
  });

  it('has correct id, tier, status', async () => {
    const { inventorySourceClient } = await import('./inventory-source');
    expect(inventorySourceClient.id).toBe('inventory-source');
    expect(inventorySourceClient.tier).toBe('v2');
    expect(inventorySourceClient.status).toBe('feed-only');
  });

  it('imageRights is false (conservative — varies by underlying supplier)', async () => {
    const { inventorySourceClient } = await import('./inventory-source');
    expect(inventorySourceClient.capabilities.imageRights).toBe(false);
  });

  it('has all 8 capabilities as booleans', async () => {
    const { inventorySourceClient } = await import('./inventory-source');
    const caps = inventorySourceClient.capabilities;
    const keys = ['unitOrder', 'noStock', 'directShip', 'neutralPackaging', 'stockPriceSync', 'tracking', 'returns', 'imageRights'] as const;
    for (const k of keys) {
      expect(typeof caps[k]).toBe('boolean');
    }
  });
});
