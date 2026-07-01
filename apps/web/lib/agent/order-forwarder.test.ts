/**
 * Unit tests for order-forwarder — registry-dispatch edition.
 *
 * DB is mocked via vi.mock('@/lib/db') — tests observe INSERT/UPDATE calls
 * and return canned row sets.  Medusa and the supplier registry are also
 * mocked so no real network calls are made.
 *
 * Covered scenarios
 * -----------------
 * (a) AliExpress item → live send writes supplier='aliexpress' + supplier_order_id + ae_order_id
 * (b) CJ (search_only) item → unmapped, no send
 * (c) 'ai-generated' row → unmapped "not a registered supplier"
 * (d) dry-run → no supplier call, persists with status='dry_run'
 * (e) Duplicate live send → 23505 collision handled gracefully
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// DB mock — captures all query calls and returns configurable row sets
// ---------------------------------------------------------------------------

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const capturedQueries: CapturedQuery[] = [];
const rowsByPattern: { pattern: string; rows: unknown[] }[] = [];

function setRows(pattern: string, rows: unknown[]) {
  rowsByPattern.push({ pattern, rows });
}

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  capturedQueries.push({ sql, params: params ?? [] });
  for (const { pattern, rows } of rowsByPattern) {
    if (sql.toLowerCase().includes(pattern.toLowerCase())) {
      return Promise.resolve({ rows: rows as T[], rowCount: rows.length });
    }
  }
  return Promise.resolve({ rows: [] as T[], rowCount: 0 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

// ---------------------------------------------------------------------------
// Medusa mock — returns a configurable order
// ---------------------------------------------------------------------------

let medusaOrder: Record<string, unknown> = {};

vi.mock('@/lib/medusa', () => ({
  medusa: {
    getOrder: vi.fn(async () => medusaOrder),
  },
}));

// ---------------------------------------------------------------------------
// Supplier registry mock — we control per-test whether placeOrder succeeds
// ---------------------------------------------------------------------------

const mockAEPlaceOrder = vi.fn();

const MOCK_AE_CAPABILITIES = {
  unitOrder: true,
  noStock: true,
  directShip: true,
  neutralPackaging: true,
  stockPriceSync: true,
  tracking: true,
  returns: true,
  imageRights: true,
};

vi.mock('@/lib/suppliers/registry', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/suppliers/registry')>();
  return {
    ...original,
    getSupplier: (id: string) => {
      if (id === 'aliexpress') {
        return {
          id: 'aliexpress',
          status: 'active',
          capabilities: MOCK_AE_CAPABILITIES,
          placeOrder: mockAEPlaceOrder,
        };
      }
      if (id === 'cj') {
        return { id: 'cj', status: 'search_only' };
      }
      throw new Error(`Unknown supplier: ${id}`);
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers to build test fixtures
// ---------------------------------------------------------------------------

function makeOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'order_test_001',
    email: 'buyer@example.com',
    shipping_address: {
      first_name: 'Jean',
      last_name: 'Dupont',
      address_1: '10 rue de la Paix',
      city: 'Paris',
      province: 'Île-de-France',
      postal_code: '75001',
      country_code: 'fr',
      phone: '+33612345678',
    },
    items: [],
    ...overrides,
  };
}

function makeItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'item_001',
    title: 'Test Product',
    product_id: 'prod_001',
    quantity: 2,
    variant: { sku: null },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedQueries.length = 0;
  rowsByPattern.length = 0;
  mockAEPlaceOrder.mockReset();

  // Default: attribution lookup returns nothing (non-fatal)
  setRows('dropship_funnel_events', []);
  // Default: INSERT into dropship_order_forwards returns a row id
  setRows('INSERT INTO dropship_order_forwards', [{ id: 'fwd_001' }]);
});

// ---------------------------------------------------------------------------
// (a) AliExpress item → live send
// ---------------------------------------------------------------------------

describe('AliExpress item — live send', () => {
  it('writes supplier=aliexpress + supplier_order_id + ae_order_id on success', async () => {
    medusaOrder = makeOrder({
      items: [makeItem()],
    });

    // Store product mapping
    setRows('dropship_store_products', [
      {
        medusa_product_id: 'prod_001',
        external_id: 'ae_12345',
        store_id: 'store_uuid_001',
        supplier: 'aliexpress',
      },
    ]);

    // Sending-lock INSERT → returns a lock row
    setRows('sending', [{ id: 'fwd_lock_001' }]);

    // AliExpress placeOrder succeeds
    mockAEPlaceOrder.mockResolvedValueOnce({
      success: true,
      supplierOrderId: 'AE_ORDER_9999',
      raw: { aliexpress_ds_order_create_response: { result: { is_success: true } } },
    });

    // UPDATE after success returns nothing meaningful
    setRows("status = 'sent'", []);

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_test_001', { dryRun: false });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.supplierOrderId).toBe('AE_ORDER_9999');
    expect(result.unmappedItems).toHaveLength(0);

    // Verify the INSERT used supplier='aliexpress'
    const lockInsert = capturedQueries.find(
      (q) => q.sql.includes('sending') && q.sql.includes('INSERT'),
    );
    expect(lockInsert).toBeDefined();
    expect(lockInsert!.params).toContain('aliexpress');

    // Verify the UPDATE writes supplier_order_id AND ae_order_id (back-compat)
    const updateQuery = capturedQueries.find(
      (q) => q.sql.includes('UPDATE') && q.sql.includes('supplier_order_id'),
    );
    expect(updateQuery).toBeDefined();
    expect(updateQuery!.params).toContain('AE_ORDER_9999'); // supplier_order_id
    // ae_order_id should also be 'AE_ORDER_9999' for aliexpress
    const aeIdx = updateQuery!.params.indexOf('AE_ORDER_9999');
    expect(updateQuery!.params[aeIdx + 1]).toBe('AE_ORDER_9999'); // ae_order_id = same
  });
});

// ---------------------------------------------------------------------------
// (b) CJ (search_only) → unmapped, no send
// ---------------------------------------------------------------------------

describe('CJ item — search_only', () => {
  it('puts item in unmapped with not-auto-forwardable reason, makes no supplier call', async () => {
    medusaOrder = makeOrder({
      items: [makeItem({ id: 'item_cj', title: 'CJ Widget', product_id: 'prod_cj' })],
    });

    setRows('dropship_store_products', [
      {
        medusa_product_id: 'prod_cj',
        external_id: 'cj_pid_001',
        store_id: 'store_uuid_001',
        supplier: 'cj',
      },
    ]);

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_test_001', { dryRun: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(result.unmappedItems).toHaveLength(1);
    expect(result.unmappedItems[0].reason).toMatch(/search_only.*not auto-forwardable/i);
    expect(mockAEPlaceOrder).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// (c) ai-generated → not a registered supplier
// ---------------------------------------------------------------------------

describe('ai-generated item', () => {
  it('puts item in unmapped with "not a registered supplier" reason', async () => {
    medusaOrder = makeOrder({
      items: [makeItem({ id: 'item_ai', title: 'AI Product', product_id: 'prod_ai' })],
    });

    setRows('dropship_store_products', [
      {
        medusa_product_id: 'prod_ai',
        external_id: 'synthetic_001',
        store_id: 'store_uuid_001',
        supplier: 'ai-generated',
      },
    ]);

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_test_001', { dryRun: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(result.unmappedItems).toHaveLength(1);
    expect(result.unmappedItems[0].reason).toMatch(/not a registered supplier/i);
    expect(mockAEPlaceOrder).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// (d) dry-run
// ---------------------------------------------------------------------------

describe('dry-run', () => {
  it('persists with status=dry_run and never calls placeOrder', async () => {
    medusaOrder = makeOrder({
      items: [makeItem()],
    });

    setRows('dropship_store_products', [
      {
        medusa_product_id: 'prod_001',
        external_id: 'ae_12345',
        store_id: 'store_uuid_001',
        supplier: 'aliexpress',
      },
    ]);

    // The default beforeEach sets INSERT → fwd_001. Override with a more
    // specific mock by replacing the dbQuery implementation for this test.
    // We capture the query and return the correct row based on SQL content.
    vi.doMock('@/lib/db', () => ({
      getDb: () => ({
        query: (sql: string, params?: unknown[]) => {
          capturedQueries.push({ sql, params: params ?? [] });
          if (sql.includes('dropship_funnel_events')) {
            return Promise.resolve({ rows: [], rowCount: 0 });
          }
          if (sql.includes('dropship_store_products')) {
            return Promise.resolve({
              rows: [{
                medusa_product_id: 'prod_001',
                external_id: 'ae_12345',
                store_id: 'store_uuid_001',
                supplier: 'aliexpress',
              }],
              rowCount: 1,
            });
          }
          if (sql.includes('INSERT') && sql.includes('dry_run')) {
            return Promise.resolve({ rows: [{ id: 'fwd_dry_001' }], rowCount: 1 });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        },
      }),
      getDbRead: () => ({ query: dbQuery }),
    }));

    vi.resetModules();

    vi.doMock('@/lib/suppliers/registry', async (importOriginal) => {
      const original = await importOriginal<typeof import('@/lib/suppliers/registry')>();
      return {
        ...original,
        getSupplier: (id: string) => {
          if (id === 'aliexpress') {
            return { id: 'aliexpress', status: 'active', capabilities: MOCK_AE_CAPABILITIES, placeOrder: mockAEPlaceOrder };
          }
          if (id === 'cj') {
            return { id: 'cj', status: 'search_only' };
          }
          throw new Error(`Unknown supplier: ${id}`);
        },
      };
    });

    vi.doMock('@/lib/medusa', () => ({
      medusa: {
        getOrder: vi.fn(async () => medusaOrder),
      },
    }));

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_test_001', { dryRun: true });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('dry_run');
    expect(result.forwardId).toBe('fwd_dry_001');
    expect(result.unmappedItems).toHaveLength(0);
    expect(mockAEPlaceOrder).not.toHaveBeenCalled();

    const dryInsert = capturedQueries.find(
      (q) => q.sql.includes('dry_run') && q.sql.includes('INSERT'),
    );
    expect(dryInsert).toBeDefined();
    // dry_run=true is a SQL literal in the INSERT, not a param
    expect(dryInsert!.sql).toContain('true');
  });
});

// ---------------------------------------------------------------------------
// (e) Duplicate live send → 23505 collision
// ---------------------------------------------------------------------------

describe('duplicate live send', () => {
  it('returns error without throwing when the unique index fires 23505', async () => {
    medusaOrder = makeOrder({
      items: [makeItem()],
    });

    setRows('dropship_store_products', [
      {
        medusa_product_id: 'prod_001',
        external_id: 'ae_12345',
        store_id: 'store_uuid_001',
        supplier: 'aliexpress',
      },
    ]);

    // Override the INSERT to throw a unique-violation
    const originalQuery = dbQuery;
    const mockQuery = vi.fn((sql: string, params?: unknown[]) => {
      if (sql.includes('sending') && sql.includes('INSERT')) {
        const err = new Error('duplicate key value violates unique constraint');
        (err as unknown as { code: string }).code = '23505';
        return Promise.reject(err);
      }
      return originalQuery(sql, params);
    });

    vi.doMock('@/lib/db', () => ({
      getDb: () => ({ query: mockQuery }),
      getDbRead: () => ({ query: mockQuery }),
    }));

    // Re-import to get the mock version
    vi.resetModules();

    // Re-mock everything for the re-import
    vi.doMock('@/lib/suppliers/registry', async (importOriginal) => {
      const original = await importOriginal<typeof import('@/lib/suppliers/registry')>();
      return {
        ...original,
        getSupplier: (id: string) => {
          if (id === 'aliexpress') {
            return { id: 'aliexpress', status: 'active', capabilities: MOCK_AE_CAPABILITIES, placeOrder: mockAEPlaceOrder };
          }
          if (id === 'cj') {
            return { id: 'cj', status: 'search_only' };
          }
          throw new Error(`Unknown supplier: ${id}`);
        },
      };
    });

    vi.doMock('@/lib/medusa', () => ({
      medusa: {
        getOrder: vi.fn(async () => medusaOrder),
      },
    }));

    vi.doMock('@/lib/db', () => ({
      getDb: () => ({ query: mockQuery }),
      getDbRead: () => ({ query: mockQuery }),
    }));

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_test_001', { dryRun: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/in-flight or completed/i);
    expect(mockAEPlaceOrder).not.toHaveBeenCalled();
  });
});
