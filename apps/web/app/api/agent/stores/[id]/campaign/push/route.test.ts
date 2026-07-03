/**
 * Unit coverage for POST /api/agent/stores/[id]/campaign/push.
 *
 * This is the deterministic path that reprises an existing `draft` Google Ads
 * campaign (the super-agent chat leaves `status='draft'` rows as a dead end).
 * The route must:
 *   - refuse when Google Ads is not configured (400),
 *   - 404 when no draft exists,
 *   - on success, reconcile the SAME draft row to status='paused',
 *   - on failure, mark the draft row status='error' and return 502.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const captured: CapturedQuery[] = [];

// Rows returned for the next SELECT calls, in order. UPDATEs return nothing.
let storeSlug: string | null = 'maison-chic';
let draftRow: Record<string, unknown> | null = null;

function dbQuery(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
  captured.push({ sql, params: params ?? [] });
  if (/FROM dropship_stores/i.test(sql)) {
    return Promise.resolve({ rows: storeSlug ? [{ slug: storeSlug }] : [] });
  }
  if (/FROM dropship_ad_campaigns/i.test(sql) && /SELECT/i.test(sql)) {
    return Promise.resolve({ rows: draftRow ? [draftRow] : [] });
  }
  return Promise.resolve({ rows: [] });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

vi.mock('@/lib/resolve-store', () => ({
  resolveStoreId: (id: string) =>
    Promise.resolve(id === 'missing' ? null : '11111111-1111-1111-1111-111111111111'),
  isUuid: () => true,
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: () => Promise.resolve(null),
}));

let configured = true;
const pushResult = { status: 'paused' as string, externalId: '999', error: undefined as string | undefined, campaignDbId: 'db-1' };

vi.mock('@/lib/ads/google-ads', () => ({
  isGoogleAdsConfigured: () => configured,
  pushGoogleAdsCampaign: () => Promise.resolve(pushResult),
}));

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(body?: unknown) {
  return new Request('http://x', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const COMPLETE_DRAFT = {
  id: 'camp-1',
  status: 'draft',
  channel: 'google',
  variant_id: 'var-1',
  daily_budget_eur: 20,
  push_payload: { days: 7 },
  headline: 'Titre',
  primary_text: 'Texte',
  description: 'Desc',
  cta: 'Acheter',
};

beforeEach(() => {
  captured.length = 0;
  storeSlug = 'maison-chic';
  draftRow = { ...COMPLETE_DRAFT };
  configured = true;
  pushResult.status = 'paused';
  pushResult.externalId = '999';
  pushResult.error = undefined;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/agent/stores/[id]/campaign/push', () => {
  it('returns 400 when Google Ads is not configured', async () => {
    configured = false;
    const { POST } = await import('./route');
    const res = await POST(makeReq(), makeCtx('store-1'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/non configuré/i);
  });

  it('returns 404 when no draft campaign exists', async () => {
    draftRow = null;
    const { POST } = await import('./route');
    const res = await POST(makeReq(), makeCtx('store-1'));
    expect(res.status).toBe(404);
  });

  it('reconciles the SAME draft row to paused on success', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeReq(), makeCtx('store-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; status: string; externalId: string };
    expect(body.success).toBe(true);
    expect(body.status).toBe('paused');
    expect(body.externalId).toBe('999');

    const update = captured.find((q) => /UPDATE dropship_ad_campaigns/i.test(q.sql) && /'paused'/.test(q.sql));
    expect(update).toBeDefined();
    // The reconciled row is the ORIGINAL draft, not a new insert.
    expect(update!.params[0]).toBe('camp-1');
    expect(update!.params[1]).toBe('999');
  });

  it('marks the draft as error and returns 502 when the push fails', async () => {
    pushResult.status = 'error';
    pushResult.externalId = null as unknown as string;
    pushResult.error = 'google-ads campaigns:mutate 400';
    const { POST } = await import('./route');
    const res = await POST(makeReq(), makeCtx('store-1'));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);

    const update = captured.find((q) => /UPDATE dropship_ad_campaigns/i.test(q.sql) && /'error'/.test(q.sql));
    expect(update).toBeDefined();
    expect(update!.params[0]).toBe('camp-1');
  });
});
