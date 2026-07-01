/**
 * Syncee supplier client tests.
 *
 * NOTE: feed/API endpoint URLs and response field names are provisional.
 * See // CONFIRM markers in syncee.ts. Update handlers when real endpoints
 * are confirmed.
 *
 * Mocking strategy:
 *   - `@/lib/db` is vi.mock'd so no real Postgres connection is made.
 *   - HTTP calls (feed URL / API) are intercepted by MSW via server.use().
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup-msw';

// ---------------------------------------------------------------------------
// Mock @/lib/db BEFORE importing syncee (module-level side-effect guard)
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();
const mockDbRead = { query: vi.fn() };

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: mockQuery }),
  getDbRead: () => mockDbRead,
}));

// Import after mock registration
import { isDropshipDirect, ingestSynceeFeed, synceeClient } from './syncee';

// ---------------------------------------------------------------------------
// isDropshipDirect — pure filter tests
// ---------------------------------------------------------------------------

describe('isDropshipDirect', () => {
  // Helper to build a base product (direct dropship, all gates pass)
  const baseDirect = () => ({
    id: 'syn-1',
    title: 'Test Product',
    price: 12.5,
    image_url: 'https://cdn.syncee.com/img.jpg',
    product_url: 'https://syncee.com/products/syn-1',
    shipping_type: 'dropship',
    supplier_type: 'dropship',
    minimum_order_quantity: 1,
    unit_price: 12.5,
  });

  it('accepts a fully direct dropship product', () => {
    expect(isDropshipDirect(baseDirect())).toBe(true);
  });

  it('rejects wholesale supplier_type', () => {
    expect(isDropshipDirect({ ...baseDirect(), supplier_type: 'wholesale' })).toBe(false);
    expect(isDropshipDirect({ ...baseDirect(), supplier_type: 'WHOLESALE' })).toBe(false);
  });

  it('rejects non-dropship shipping_type', () => {
    expect(isDropshipDirect({ ...baseDirect(), shipping_type: 'wholesale' })).toBe(false);
    expect(isDropshipDirect({ ...baseDirect(), shipping_type: 'bulk' })).toBe(false);
  });

  it('accepts when shipping_type is undefined (field not present)', () => {
    const p = { ...baseDirect() };
    delete (p as Partial<typeof p>).shipping_type;
    expect(isDropshipDirect(p as Parameters<typeof isDropshipDirect>[0])).toBe(true);
  });

  it('rejects MOQ > 1', () => {
    expect(isDropshipDirect({ ...baseDirect(), minimum_order_quantity: 2 })).toBe(false);
    expect(isDropshipDirect({ ...baseDirect(), minimum_order_quantity: 100 })).toBe(false);
  });

  it('accepts MOQ = 1 (the minimum)', () => {
    expect(isDropshipDirect({ ...baseDirect(), minimum_order_quantity: 1 })).toBe(true);
  });

  it('accepts when MOQ is undefined (defaults to 1)', () => {
    const p = { ...baseDirect() };
    delete (p as Partial<typeof p>).minimum_order_quantity;
    expect(isDropshipDirect(p as Parameters<typeof isDropshipDirect>[0])).toBe(true);
  });

  it('rejects when effective price is 0 (no per-unit price)', () => {
    expect(isDropshipDirect({ ...baseDirect(), price: 0, unit_price: 0 })).toBe(false);
  });

  it('rejects mixed fixture: wholesale dropped, direct kept', () => {
    const products = [
      baseDirect(),                                                  // ✓ direct
      { ...baseDirect(), id: 'syn-w1', supplier_type: 'wholesale' }, // ✗ wholesale
      { ...baseDirect(), id: 'syn-m1', minimum_order_quantity: 5 }, // ✗ MOQ
      { ...baseDirect(), id: 'syn-2' },                             // ✓ direct
      { ...baseDirect(), id: 'syn-p0', price: 0, unit_price: 0 },  // ✗ no price
    ];
    const kept = products.filter(isDropshipDirect);
    expect(kept).toHaveLength(2);
    expect(kept.map((p) => p.id)).toEqual(['syn-1', 'syn-2']);
  });
});

// ---------------------------------------------------------------------------
// ingestSynceeFeed — via feed URL
// ---------------------------------------------------------------------------

const FEED_URL = 'https://feed.syncee.co/store/test-feed.json';

const MOCK_FEED_PRODUCTS = [
  {
    id: 'syn-a',
    title: 'Direct Product A',
    price: 15.0,
    image_url: 'https://cdn.syncee.com/a.jpg',
    product_url: 'https://syncee.com/p/a',
    shipping_type: 'dropship',
    supplier_type: 'dropship',
    minimum_order_quantity: 1,
    unit_price: 15.0,
  },
  {
    id: 'syn-w',
    title: 'Wholesale Product (should be dropped)',
    price: 5.0,
    image_url: 'https://cdn.syncee.com/w.jpg',
    product_url: 'https://syncee.com/p/w',
    supplier_type: 'wholesale',
    minimum_order_quantity: 10,
    unit_price: 5.0,
  },
  {
    id: 'syn-b',
    title: 'Direct Product B',
    price: 22.5,
    image_url: 'https://cdn.syncee.com/b.jpg',
    product_url: 'https://syncee.com/p/b',
    shipping_type: 'direct',
    supplier_type: 'dropship',
    minimum_order_quantity: 1,
    unit_price: 22.5,
  },
];

describe('ingestSynceeFeed — no credentials', () => {
  beforeEach(() => {
    vi.stubEnv('SUPPLIER_SYNCEE_API_KEY', '');
    vi.stubEnv('SUPPLIER_SYNCEE_FEED_URL', '');
    mockQuery.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockQuery.mockReset();
  });

  it('returns error when neither key nor feed URL is set', async () => {
    const result = await ingestSynceeFeed();
    expect(result.upserted).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it('does not call DB when no credentials', async () => {
    await ingestSynceeFeed();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('ingestSynceeFeed — feed URL configured', () => {
  beforeEach(() => {
    vi.stubEnv('SUPPLIER_SYNCEE_API_KEY', '');
    vi.stubEnv('SUPPLIER_SYNCEE_FEED_URL', FEED_URL);
    mockQuery.mockReset();

    server.use(
      http.get(FEED_URL, () => {
        return HttpResponse.json(MOCK_FEED_PRODUCTS, {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockQuery.mockReset();
  });

  it('upserts only direct products (2 of 3)', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const result = await ingestSynceeFeed();
    expect(result.upserted).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('calls getDb().query with supplier=syncee and is_dropship_direct=true in the SQL', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await ingestSynceeFeed();
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/INSERT INTO public\.dropship_supplier_catalog/i);
    // The real SQL puts ON CONFLICT and DO UPDATE on separate lines, so we
    // match across the newline with [\s\S]* (avoids the es2018-only `s` flag).
    expect(sql).toMatch(/ON CONFLICT[\s\S]*DO UPDATE/i);
    // All values arrays must contain 'syncee' as the supplier
    expect(values).toContain('syncee');
    // is_dropship_direct = true for all inserted rows
    expect(values).toContain(true);
  });

  it('does not include wholesale products in the upsert values', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await ingestSynceeFeed();
    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    // The wholesale product title must not appear in VALUES
    expect(values).not.toContain('Wholesale Product (should be dropped)');
    // Direct products must be present
    expect(values).toContain('Direct Product A');
    expect(values).toContain('Direct Product B');
  });
});

describe('ingestSynceeFeed — DB error', () => {
  beforeEach(() => {
    vi.stubEnv('SUPPLIER_SYNCEE_API_KEY', '');
    vi.stubEnv('SUPPLIER_SYNCEE_FEED_URL', FEED_URL);
    mockQuery.mockReset();

    server.use(
      http.get(FEED_URL, () => {
        return HttpResponse.json(MOCK_FEED_PRODUCTS, {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockQuery.mockReset();
  });

  it('returns upserted:0 and error message when DB throws', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));
    const result = await ingestSynceeFeed();
    expect(result.upserted).toBe(0);
    expect(result.error).toMatch(/connection refused/);
  });
});

// ---------------------------------------------------------------------------
// synceeClient.searchProducts — reads from dropship_supplier_catalog
// ---------------------------------------------------------------------------

describe('synceeClient.searchProducts', () => {
  beforeEach(() => {
    mockDbRead.query.mockReset();
  });

  afterEach(() => {
    mockDbRead.query.mockReset();
  });

  it('returns mapped RawProduct[] on success', async () => {
    mockDbRead.query.mockResolvedValue({
      rows: [
        {
          external_id: 'syn-a',
          title: 'Direct Product A',
          price_eur: '15.00',
          image_url: 'https://cdn.syncee.com/a.jpg',
          supplier_url: 'https://syncee.com/p/a',
        },
        {
          external_id: 'syn-b',
          title: 'Direct Product B',
          price_eur: '22.50',
          image_url: 'https://cdn.syncee.com/b.jpg',
          supplier_url: 'https://syncee.com/p/b',
        },
      ],
    });

    const result = await synceeClient.searchProducts({ keywords: 'product' });
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toMatchObject({
      supplier: 'syncee',
      externalId: 'syn-a',
      title: 'Direct Product A',
      price: 15.0,
      imageUrl: 'https://cdn.syncee.com/a.jpg',
      supplierUrl: 'https://syncee.com/p/a',
    });
    expect(result.products[1]!.price).toBe(22.5);
  });

  it('queries supplier=syncee and is_dropship_direct=true', async () => {
    mockDbRead.query.mockResolvedValue({ rows: [] });
    await synceeClient.searchProducts({ keywords: 'yoga mat' });
    expect(mockDbRead.query).toHaveBeenCalledTimes(1);
    const [sql] = mockDbRead.query.mock.calls[0] as [string];
    expect(sql).toMatch(/supplier = 'syncee'/i);
    expect(sql).toMatch(/is_dropship_direct = true/i);
  });

  it('applies ILIKE keyword filter', async () => {
    mockDbRead.query.mockResolvedValue({ rows: [] });
    await synceeClient.searchProducts({ keywords: 'yoga mat' });
    const [, params] = mockDbRead.query.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toContain('%yoga mat%');
  });

  it('returns success:true with empty array when no rows match', async () => {
    mockDbRead.query.mockResolvedValue({ rows: [] });
    const result = await synceeClient.searchProducts({ keywords: 'xyz-no-match' });
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('returns success:false with error when DB throws (table may be absent)', async () => {
    mockDbRead.query.mockRejectedValue(new Error('relation "dropship_supplier_catalog" does not exist'));
    const result = await synceeClient.searchProducts({ keywords: 'test' });
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
    expect(result.error).toMatch(/dropship_supplier_catalog/);
  });
});

// ---------------------------------------------------------------------------
// synceeClient — manifest assertions
// ---------------------------------------------------------------------------

describe('synceeClient — manifest assertions', () => {
  it('id is syncee', () => {
    expect(synceeClient.id).toBe('syncee');
  });

  it('status is feed-only', () => {
    expect(synceeClient.status).toBe('feed-only');
  });

  it('placeOrder is undefined (feed-only)', () => {
    expect(synceeClient.placeOrder).toBeUndefined();
  });

  it('tier is v1', () => {
    expect(synceeClient.tier).toBe('v1');
  });

  it('all 8 capabilities are present and boolean', () => {
    const caps = synceeClient.capabilities;
    const keys = [
      'unitOrder', 'noStock', 'directShip', 'neutralPackaging',
      'stockPriceSync', 'tracking', 'returns', 'imageRights',
    ] as const;
    for (const k of keys) {
      expect(typeof caps[k]).toBe('boolean');
    }
  });
});
