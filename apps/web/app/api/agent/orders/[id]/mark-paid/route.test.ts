/**
 * Unit coverage for POST /api/agent/orders/[id]/mark-paid.
 *
 * The "a payer chez AliExpress" flow is AliExpress-specific: it flips paid_at on
 * the AE leg only. A mixed AE+CJ cart must never mark the CJ (or newest) leg as
 * paid — that would leave the real AE order unpaid AND hidden from the admin
 * "a payer" list (which filters paid_at IS NULL).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const captured: CapturedQuery[] = [];
let nextRowCount = 1;

function dbQuery(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> {
  captured.push({ sql, params: params ?? [] });
  return Promise.resolve({ rows: [], rowCount: nextRowCount });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  captured.length = 0;
  nextRowCount = 1;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/agent/orders/[id]/mark-paid', () => {
  it('scopes the UPDATE to the AliExpress leg (mixed cart must not flip the CJ leg)', async () => {
    const { POST } = await import('./route');
    const res = await POST(new Request('http://x'), makeCtx('order_mixed_01'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    // The row-selection subquery must be scoped to supplier='aliexpress' so a
    // mixed AE+CJ cart flips paid_at on the AE leg, not the most-recent CJ leg.
    const update = captured.find((q) => q.sql.includes('SET paid_at'));
    expect(update).toBeDefined();
    expect(update!.sql).toMatch(/supplier\s*=\s*'aliexpress'/);
    expect(update!.sql).toMatch(/status\s*=\s*'sent'/);
    expect(update!.sql).toMatch(/dry_run\s*=\s*false/);
    expect(update!.params).toEqual(['order_mixed_01']);
  });

  it('returns 404 when no live AliExpress forward exists for the order', async () => {
    nextRowCount = 0;
    const { POST } = await import('./route');
    const res = await POST(new Request('http://x'), makeCtx('order_no_ae'));

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/AliExpress/i);
  });
});
