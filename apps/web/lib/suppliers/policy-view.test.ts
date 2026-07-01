import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB module before importing policy-view (which imports it).
vi.mock('@/lib/db', () => ({
  getDbRead: vi.fn(),
}));

// Mock the registry and policy so tests are isolated from real client files
// that have side-effects (env reads, OAuth etc.).
vi.mock('./registry', () => {
  const listSuppliers = vi.fn(() => [
    {
      id: 'aliexpress',
      label: 'AliExpress DS',
      tier: 'v1',
      status: 'active',
      capabilities: {
        unitOrder: true,
        noStock: true,
        directShip: true,
        neutralPackaging: true,
        stockPriceSync: true,
        tracking: true,
        returns: false,
        imageRights: true,
      },
      placeOrder: async () => ({ success: true, raw: null }),
    },
    {
      id: 'cj',
      label: 'CJ Dropshipping',
      tier: 'v1',
      status: 'feed-only',
      capabilities: {
        unitOrder: true,
        noStock: true,
        directShip: true,
        neutralPackaging: false,
        stockPriceSync: true,
        tracking: true,
        returns: false,
        imageRights: false,
      },
    },
  ]);
  return { listSuppliers };
});

vi.mock('./policy', () => {
  const EXCLUDED_PLATFORMS = [
    { id: 'alibaba', label: 'Alibaba (classic)', reason: 'moq', note: 'MOQ eleve' },
    { id: '1688', label: '1688', reason: 'wholesale', note: 'Grossiste CN' },
    { id: 'taobao', label: 'Taobao', reason: 'no-fulfillment', note: 'Marketplace C2C' },
  ];
  return { EXCLUDED_PLATFORMS };
});

import { getDbRead } from '@/lib/db';
import { getSupplierPolicyView } from './policy-view';

const mockGetDbRead = vi.mocked(getDbRead);

/** Helper that makes getDbRead() return the given rows for dropship_suppliers. */
function mockDbReturns(rows: Record<string, unknown>[]) {
  mockGetDbRead.mockReturnValue({
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as ReturnType<typeof getDbRead>);
}

/** Helper that makes getDbRead() throw (simulating missing table). */
function mockDbThrows(err: unknown = new Error('relation "dropship_suppliers" does not exist')) {
  mockGetDbRead.mockReturnValue({
    query: vi.fn().mockRejectedValue(err),
  } as unknown as ReturnType<typeof getDbRead>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSupplierPolicyView — DB available', () => {
  it('includes active suppliers from the registry manifests', async () => {
    mockDbReturns([]);
    const rows = await getSupplierPolicyView();
    const ids = rows.map((r) => r.id);
    expect(ids).toContain('aliexpress');
    expect(ids).toContain('cj');
  });

  it('marks registry suppliers with their tier from the manifest', async () => {
    mockDbReturns([]);
    const rows = await getSupplierPolicyView();
    const ae = rows.find((r) => r.id === 'aliexpress');
    expect(ae?.tier).toBe('v1');
    expect(ae?.status).toBe('active');
  });

  it('includes all EXCLUDED_PLATFORMS as excluded rows', async () => {
    mockDbReturns([]);
    const rows = await getSupplierPolicyView();
    const excludedIds = rows.filter((r) => r.status === 'excluded').map((r) => r.id);
    expect(excludedIds).toContain('alibaba');
    expect(excludedIds).toContain('1688');
    expect(excludedIds).toContain('taobao');
  });

  it('populates exclusionReason and exclusionNote for excluded rows', async () => {
    mockDbReturns([]);
    const rows = await getSupplierPolicyView();
    const alibaba = rows.find((r) => r.id === 'alibaba');
    expect(alibaba?.exclusionReason).toBe('moq');
    expect(alibaba?.exclusionNote).toBe('MOQ eleve');
  });

  it('includes autods as automation status', async () => {
    mockDbReturns([]);
    const rows = await getSupplierPolicyView();
    const autods = rows.find((r) => r.id === 'autods');
    expect(autods).toBeDefined();
    expect(autods?.status).toBe('automation');
    expect(autods?.label).toBe('AutoDS (automation)');
  });

  it('sorts active/feed-only before automation before excluded', async () => {
    mockDbReturns([]);
    const rows = await getSupplierPolicyView();
    const statuses = rows.map((r) => r.status);
    const firstAutomationIdx = statuses.indexOf('automation');
    const firstExcludedIdx = statuses.indexOf('excluded');
    const lastActiveIdx = Math.max(
      statuses.lastIndexOf('active'),
      statuses.lastIndexOf('feed-only'),
      statuses.lastIndexOf('search_only'),
    );
    expect(lastActiveIdx).toBeLessThan(firstAutomationIdx);
    expect(firstAutomationIdx).toBeLessThan(firstExcludedIdx);
  });

  it('DB row overwrites matching constant row (label + connectionState)', async () => {
    mockDbReturns([
      {
        id: 'aliexpress',
        label: 'AliExpress DS (overridden)',
        tier: 'v2',
        status: 'active',
        capabilities: { unitOrder: true },
        exclusion_reason: null,
        exclusion_note: null,
        connection_state: 'connected',
        last_checked_at: null,
      },
    ]);
    const rows = await getSupplierPolicyView();
    const ae = rows.find((r) => r.id === 'aliexpress');
    expect(ae?.label).toBe('AliExpress DS (overridden)');
    expect(ae?.tier).toBe('v2');
    expect(ae?.connectionState).toBe('connected');
  });

  it('sets connectionState to "unknown" for rows built from constants', async () => {
    mockDbReturns([]);
    const rows = await getSupplierPolicyView();
    // All rows come from constants when DB returns empty.
    for (const r of rows) {
      expect(r.connectionState).toBe('unknown');
    }
  });
});

describe('getSupplierPolicyView — DB fallback (getDbRead throws)', () => {
  it('falls back to constants when getDbRead().query rejects', async () => {
    mockDbThrows();
    const rows = await getSupplierPolicyView();
    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain('aliexpress');
    expect(ids).toContain('cj');
    expect(ids).toContain('alibaba');
    expect(ids).toContain('autods');
  });

  it('still includes all EXCLUDED_PLATFORMS on DB error', async () => {
    mockDbThrows(new Error('ECONNREFUSED'));
    const rows = await getSupplierPolicyView();
    const excluded = rows.filter((r) => r.status === 'excluded').map((r) => r.id);
    expect(excluded).toContain('alibaba');
    expect(excluded).toContain('1688');
    expect(excluded).toContain('taobao');
  });

  it('still includes autods as automation on DB error', async () => {
    mockDbThrows();
    const rows = await getSupplierPolicyView();
    const autods = rows.find((r) => r.id === 'autods');
    expect(autods?.status).toBe('automation');
  });

  it('marks all fallback rows with connectionState "unknown"', async () => {
    mockDbThrows();
    const rows = await getSupplierPolicyView();
    for (const r of rows) {
      expect(r.connectionState).toBe('unknown');
    }
  });

  it('preserves correct sort order on DB error', async () => {
    mockDbThrows();
    const rows = await getSupplierPolicyView();
    const statuses = rows.map((r) => r.status);
    const firstAutomationIdx = statuses.indexOf('automation');
    const firstExcludedIdx = statuses.indexOf('excluded');
    const lastSourceIdx = Math.max(
      statuses.lastIndexOf('active'),
      statuses.lastIndexOf('feed-only'),
      statuses.lastIndexOf('search_only'),
    );
    expect(lastSourceIdx).toBeLessThan(firstAutomationIdx);
    expect(firstAutomationIdx).toBeLessThan(firstExcludedIdx);
  });
});
