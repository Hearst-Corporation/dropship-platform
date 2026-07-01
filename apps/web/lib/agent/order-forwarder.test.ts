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
 * (b) Spocket (search_only, no placeOrder) item → unmapped, no send (a REALLY
 *     non-forwardable supplier — CJ is active + forwardable in production)
 * (b2) CJ (active) item → forwarded (supplier_order_id, NO ae_order_id)
 * (c) 'ai-generated' row → unmapped "not a registered supplier"
 * (d) dry-run → no supplier call, persists with status='dry_run'
 * (e) Duplicate live send → 23505 collision handled gracefully
 * (f) AutoDS routing → supplier_order_id set, ae_order_id NOT poisoned
 * (g) Mixed cart (AliExpress + CJ) → TWO forward rows, neither leg dropped
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
const mockCJPlaceOrder = vi.fn();

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

// Shared supplier-registry mock. Mirrors PRODUCTION statuses:
//   aliexpress → active + placeOrder (forwardable)
//   cj         → active + placeOrder (forwardable — NOT search_only)
//   spocket    → search_only, NO placeOrder (genuinely non-forwardable)
function mockGetSupplier(id: string) {
  if (id === 'aliexpress') {
    return { id: 'aliexpress', status: 'active', capabilities: MOCK_AE_CAPABILITIES, placeOrder: mockAEPlaceOrder };
  }
  if (id === 'cj') {
    return { id: 'cj', status: 'active', capabilities: MOCK_AE_CAPABILITIES, placeOrder: mockCJPlaceOrder };
  }
  if (id === 'spocket') {
    // search_only + no placeOrder → canAutoForward() === false in production.
    return { id: 'spocket', status: 'search_only', capabilities: MOCK_AE_CAPABILITIES };
  }
  throw new Error(`Unknown supplier: ${id}`);
}

vi.mock('@/lib/suppliers/registry', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/suppliers/registry')>();
  return {
    ...original,
    getSupplier: (id: string) => mockGetSupplier(id),
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
  mockCJPlaceOrder.mockReset();

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
    expect(result.forwards).toHaveLength(1);
    expect(result.forwards[0].supplier).toBe('aliexpress');
    expect(result.forwards[0].status).toBe('sent');
    expect(result.forwards[0].supplierOrderId).toBe('AE_ORDER_9999');
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
// (b) Spocket (search_only, no placeOrder) → unmapped, no send.
//     This is a supplier that is REALLY non-forwardable in production —
//     unlike CJ, which is active + forwardable (see test b2).
// ---------------------------------------------------------------------------

describe('Spocket item — search_only (genuinely non-forwardable)', () => {
  it('puts item in unmapped with not-auto-forwardable reason, makes no supplier call', async () => {
    medusaOrder = makeOrder({
      items: [makeItem({ id: 'item_spk', title: 'Spocket Widget', product_id: 'prod_spk' })],
    });

    setRows('dropship_store_products', [
      {
        medusa_product_id: 'prod_spk',
        external_id: 'spk_pid_001',
        store_id: 'store_uuid_001',
        supplier: 'spocket',
      },
    ]);

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_test_001', { dryRun: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(result.unmappedItems).toHaveLength(1);
    expect(result.unmappedItems[0].reason).toMatch(/search_only.*not auto-forwardable/i);
    expect(mockAEPlaceOrder).not.toHaveBeenCalled();
    expect(mockCJPlaceOrder).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// (b2) CJ is active + forwardable in production → its items ARE forwarded.
//      Live send writes supplier='cj' + supplier_order_id, and NO ae_order_id.
// ---------------------------------------------------------------------------

describe('CJ item — active + forwardable', () => {
  it('forwards a CJ item: supplier=cj, supplier_order_id set, ae_order_id NULL', async () => {
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

    setRows('sending', [{ id: 'fwd_lock_cj' }]);

    mockCJPlaceOrder.mockResolvedValueOnce({
      success: true,
      supplierOrderId: 'CJ_ORDER_777',
      raw: { orderId: 'CJ_ORDER_777' },
    });
    setRows("status = 'sent'", []);

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_test_001', { dryRun: false });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.forwards).toHaveLength(1);
    expect(result.forwards[0].supplier).toBe('cj');
    expect(result.forwards[0].supplierOrderId).toBe('CJ_ORDER_777');
    expect(result.unmappedItems).toHaveLength(0);
    expect(mockCJPlaceOrder).toHaveBeenCalledOnce();
    expect(mockAEPlaceOrder).not.toHaveBeenCalled();

    // INSERT lock used supplier='cj'
    const lockInsert = capturedQueries.find(
      (q) => q.sql.includes('sending') && q.sql.includes('INSERT'),
    );
    expect(lockInsert).toBeDefined();
    expect(lockInsert!.params).toContain('cj');

    // UPDATE writes supplier_order_id = CJ_ORDER_777 and ae_order_id = null (CJ is not AE).
    const updateQuery = capturedQueries.find(
      (q) => q.sql.includes('UPDATE') && q.sql.includes('supplier_order_id'),
    );
    expect(updateQuery).toBeDefined();
    expect(updateQuery!.params).toContain('CJ_ORDER_777'); // supplier_order_id
    const cjIdx = updateQuery!.params.indexOf('CJ_ORDER_777');
    expect(updateQuery!.params[cjIdx + 1]).toBeNull(); // ae_order_id = null for CJ
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
        getSupplier: (id: string) => mockGetSupplier(id),
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
    expect(result.forwards).toHaveLength(1);
    expect(result.forwards[0].forwardId).toBe('fwd_dry_001');
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
        getSupplier: (id: string) => mockGetSupplier(id),
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

// ---------------------------------------------------------------------------
// (f) AUTODS_ROUTING_ENABLED=1 — AE order routes via AutoDS
//     assertDropshipPure is re-enforced on the underlying supplier
// ---------------------------------------------------------------------------

describe('AutoDS routing gate', () => {
  it('with AUTODS_ROUTING_ENABLED=1, an AE order is routed via AutoDS and assertDropshipPure is enforced', async () => {
    // Use doMock + resetModules so we can control the autods module for this test
    vi.resetModules();

    // Typed param so mock.calls[0][0] is well-typed (underlyingSupplier /
    // outOrderId are asserted below).
    const mockRouteFn = vi.fn(async (_input: { underlyingSupplier: string; outOrderId: string }) => ({
      success: true,
      autodsOrderId: 'AUTODS_ORDER_001',
      raw: { order_id: 'AUTODS_ORDER_001', status: 'placed' },
    }));

    vi.doMock('@/lib/automation/autods', () => ({
      routeOrderViaAutoDS: mockRouteFn,
    }));

    // Re-mock DB — needs to handle INSERT+UPDATE for the lock + AutoDS success path
    const capturedAutodsQueries: { sql: string; params: unknown[] }[] = [];
    vi.doMock('@/lib/db', () => ({
      getDb: () => ({
        query: (sql: string, params?: unknown[]) => {
          capturedAutodsQueries.push({ sql, params: params ?? [] });
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
          if (sql.includes('INSERT') && sql.includes('sending')) {
            return Promise.resolve({ rows: [{ id: 'fwd_autods_lock_001' }], rowCount: 1 });
          }
          if (sql.includes('UPDATE')) {
            return Promise.resolve({ rows: [], rowCount: 1 });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        },
      }),
      getDbRead: () => ({ query: () => Promise.resolve({ rows: [], rowCount: 0 }) }),
    }));

    vi.doMock('@/lib/medusa', () => ({
      medusa: {
        getOrder: vi.fn(async () => ({
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
          items: [{
            id: 'item_001',
            title: 'Test Product',
            product_id: 'prod_001',
            quantity: 1,
            variant: { sku: null },
          }],
        })),
      },
    }));

    vi.doMock('@/lib/suppliers/registry', async (importOriginal) => {
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
          throw new Error(`Unknown supplier: ${id}`);
        },
      };
    });

    // Enable AutoDS routing
    vi.stubEnv('AUTODS_ROUTING_ENABLED', '1');

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_test_001', { dryRun: false });

    // AutoDS mock succeeded → result should be 'sent'
    expect(result.ok).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.forwards).toHaveLength(1);
    expect(result.forwards[0].supplierOrderId).toBe('AUTODS_ORDER_001');

    // routeOrderViaAutoDS was called with the right underlying supplier
    expect(mockRouteFn).toHaveBeenCalledOnce();
    const callArg = mockRouteFn.mock.calls[0]![0];
    expect(callArg.underlyingSupplier).toBe('aliexpress');
    expect(callArg.outOrderId).toBe('order_test_001');

    // Direct placeOrder on the supplier was NOT called — AutoDS handled it
    expect(mockAEPlaceOrder).not.toHaveBeenCalled();

    // assertDropshipPure enforcement: the aliexpress client has all hard criteria set,
    // so it should NOT have thrown. Verify by checking the result succeeded.
    // (If assertDropshipPure had thrown, result.status would be 'error'.)
    expect(result.status).toBe('sent');

    // Verify the UPDATE wrote supplier_order_id = AUTODS_ORDER_001
    const updateQ = capturedAutodsQueries.find(
      (q) => q.sql.includes('UPDATE') && q.sql.includes('supplier_order_id'),
    );
    expect(updateQ).toBeDefined();
    expect(updateQ!.params).toContain('AUTODS_ORDER_001');

    // FIX-4: the AutoDS order id must NOT be written into ae_order_id — that
    // column is an AliExpress order number only (poisoning it breaks
    // aliExpressOrderUrl + the AE stranded scan). The AutoDS UPDATE must not
    // even touch ae_order_id.
    expect(updateQ!.sql).not.toContain('ae_order_id');

    vi.unstubAllEnvs();
  });

  it('assertDropshipPure blocks a non-dropship-pur underlying supplier even when AUTODS_ROUTING_ENABLED=1', async () => {
    vi.resetModules();

    vi.doMock('@/lib/automation/autods', () => ({
      routeOrderViaAutoDS: vi.fn(),
    }));

    const capturedAutodsQ2: { sql: string; params: unknown[] }[] = [];
    vi.doMock('@/lib/db', () => ({
      getDb: () => ({
        query: (sql: string, params?: unknown[]) => {
          capturedAutodsQ2.push({ sql, params: params ?? [] });
          if (sql.includes('dropship_funnel_events')) return Promise.resolve({ rows: [], rowCount: 0 });
          if (sql.includes('dropship_store_products')) {
            return Promise.resolve({
              rows: [{ medusa_product_id: 'prod_002', external_id: 'ae_99', store_id: 'store_001', supplier: 'aliexpress' }],
              rowCount: 1,
            });
          }
          if (sql.includes('INSERT') && sql.includes('sending')) return Promise.resolve({ rows: [{ id: 'fwd_lock_x' }], rowCount: 1 });
          if (sql.includes('UPDATE')) return Promise.resolve({ rows: [], rowCount: 1 });
          return Promise.resolve({ rows: [], rowCount: 0 });
        },
      }),
      getDbRead: () => ({ query: () => Promise.resolve({ rows: [], rowCount: 0 }) }),
    }));

    vi.doMock('@/lib/medusa', () => ({
      medusa: {
        getOrder: vi.fn(async () => ({
          id: 'order_test_002',
          email: 'buyer@example.com',
          shipping_address: {
            first_name: 'Jean', last_name: 'Dupont',
            address_1: '10 rue', city: 'Paris', province: 'IDF',
            postal_code: '75001', country_code: 'fr', phone: '+33600000000',
          },
          items: [{ id: 'item_002', title: 'Blocked Product', product_id: 'prod_002', quantity: 1, variant: { sku: null } }],
        })),
      },
    }));

    // Supplier deliberately fails the policy gate (unitOrder: false)
    vi.doMock('@/lib/suppliers/registry', async (importOriginal) => {
      const original = await importOriginal<typeof import('@/lib/suppliers/registry')>();
      return {
        ...original,
        getSupplier: (id: string) => {
          if (id === 'aliexpress') {
            return {
              id: 'aliexpress',
              status: 'active',
              capabilities: { ...MOCK_AE_CAPABILITIES, unitOrder: false }, // fails hard criterion
              placeOrder: mockAEPlaceOrder,
            };
          }
          throw new Error(`Unknown supplier: ${id}`);
        },
      };
    });

    vi.stubEnv('AUTODS_ROUTING_ENABLED', '1');

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_test_002', { dryRun: false });

    // assertDropshipPure should have caught unitOrder:false → result is 'error'
    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/blocked from dropship-pur/i);

    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// (g) Mixed cart (1 AliExpress item + 1 CJ item) — THE multi-supplier fix.
//     BOTH legs must be forwarded as their OWN forward row (one per supplier);
//     neither leg is silently deferred/dropped.
// ---------------------------------------------------------------------------

describe('mixed-supplier cart', () => {
  it('forwards BOTH the AliExpress and CJ legs as separate rows — no leg dropped', async () => {
    vi.resetModules();

    // DB mock: two distinct products (AE + CJ), two distinct sending locks.
    const capturedMixed: { sql: string; params: unknown[] }[] = [];
    vi.doMock('@/lib/db', () => ({
      getDb: () => ({
        query: (sql: string, params?: unknown[]) => {
          capturedMixed.push({ sql, params: params ?? [] });
          if (sql.includes('dropship_funnel_events')) {
            return Promise.resolve({ rows: [], rowCount: 0 });
          }
          if (sql.includes('dropship_store_products')) {
            return Promise.resolve({
              rows: [
                { medusa_product_id: 'prod_ae', external_id: 'ae_111', store_id: 'store_uuid_001', supplier: 'aliexpress' },
                { medusa_product_id: 'prod_cj', external_id: 'cj_222', store_id: 'store_uuid_001', supplier: 'cj' },
              ],
              rowCount: 2,
            });
          }
          if (sql.includes('INSERT') && sql.includes('sending')) {
            // Return a lock id keyed off the supplier param (last positional param).
            const supplier = params?.[params.length - 1];
            const id = supplier === 'aliexpress' ? 'fwd_lock_ae' : 'fwd_lock_cj';
            return Promise.resolve({ rows: [{ id }], rowCount: 1 });
          }
          if (sql.includes('UPDATE')) {
            return Promise.resolve({ rows: [], rowCount: 1 });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        },
      }),
      getDbRead: () => ({ query: () => Promise.resolve({ rows: [], rowCount: 0 }) }),
    }));

    vi.doMock('@/lib/medusa', () => ({
      medusa: {
        getOrder: vi.fn(async () => ({
          id: 'order_mixed_001',
          email: 'buyer@example.com',
          shipping_address: {
            first_name: 'Jean', last_name: 'Dupont',
            address_1: '10 rue de la Paix', city: 'Paris', province: 'Île-de-France',
            postal_code: '75001', country_code: 'fr', phone: '+33612345678',
          },
          items: [
            { id: 'item_ae', title: 'AE Product', product_id: 'prod_ae', quantity: 1, variant: { sku: null } },
            { id: 'item_cj', title: 'CJ Product', product_id: 'prod_cj', quantity: 2, variant: { sku: null } },
          ],
        })),
      },
    }));

    vi.doMock('@/lib/suppliers/registry', async (importOriginal) => {
      const original = await importOriginal<typeof import('@/lib/suppliers/registry')>();
      return {
        ...original,
        getSupplier: (id: string) => mockGetSupplier(id),
      };
    });

    mockAEPlaceOrder.mockResolvedValueOnce({
      success: true,
      supplierOrderId: 'AE_ORDER_111',
      raw: { ae: true },
    });
    mockCJPlaceOrder.mockResolvedValueOnce({
      success: true,
      supplierOrderId: 'CJ_ORDER_222',
      raw: { cj: true },
    });

    const { forwardOrder } = await import('./order-forwarder');
    const result = await forwardOrder('order_mixed_001', { dryRun: false });

    // Both legs forwarded — nothing dropped, nothing unmapped.
    expect(result.ok).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.unmappedItems).toHaveLength(0);
    expect(result.forwards).toHaveLength(2);

    const bySupplier = new Map(result.forwards.map((f) => [f.supplier, f]));
    expect(bySupplier.get('aliexpress')?.status).toBe('sent');
    expect(bySupplier.get('aliexpress')?.supplierOrderId).toBe('AE_ORDER_111');
    expect(bySupplier.get('aliexpress')?.forwardId).toBe('fwd_lock_ae');
    expect(bySupplier.get('cj')?.status).toBe('sent');
    expect(bySupplier.get('cj')?.supplierOrderId).toBe('CJ_ORDER_222');
    expect(bySupplier.get('cj')?.forwardId).toBe('fwd_lock_cj');

    // Both suppliers were actually called.
    expect(mockAEPlaceOrder).toHaveBeenCalledOnce();
    expect(mockCJPlaceOrder).toHaveBeenCalledOnce();

    // TWO distinct sending-lock INSERTs — one per supplier.
    const lockInserts = capturedMixed.filter(
      (q) => q.sql.includes('INSERT') && q.sql.includes('sending'),
    );
    expect(lockInserts).toHaveLength(2);
    const lockSuppliers = lockInserts.map((q) => q.params[q.params.length - 1]);
    expect(lockSuppliers).toContain('aliexpress');
    expect(lockSuppliers).toContain('cj');

    // AE UPDATE writes ae_order_id; CJ UPDATE leaves it null.
    const aeUpdate = capturedMixed.find(
      (q) => q.sql.includes('UPDATE') && q.params.includes('AE_ORDER_111'),
    );
    const aeIdx = aeUpdate!.params.indexOf('AE_ORDER_111');
    expect(aeUpdate!.params[aeIdx + 1]).toBe('AE_ORDER_111'); // ae_order_id set for AE
    const cjUpdate = capturedMixed.find(
      (q) => q.sql.includes('UPDATE') && q.params.includes('CJ_ORDER_222'),
    );
    const cjIdx = cjUpdate!.params.indexOf('CJ_ORDER_222');
    expect(cjUpdate!.params[cjIdx + 1]).toBeNull(); // ae_order_id NULL for CJ
  });
});
