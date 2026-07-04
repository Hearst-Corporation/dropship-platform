/**
 * Coverage for getHistoricalPerformanceSummary / formatHistoricalPerformanceForPrompt.
 * - happy path: campaign rows aggregate into a ranked, capped summary
 * - empty database (fresh platform / all stores just cleared): returns null, no throw
 * - DB error: fails soft, returns null, no throw
 * - formatter: omits the section entirely for null/empty, renders advisory text otherwise
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const captured: CapturedQuery[] = [];
let cannedRows: unknown[] = [];
let shouldThrow = false;

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  captured.push({ sql, params: params ?? [] });
  if (shouldThrow) {
    return Promise.reject(new Error('connection terminated unexpectedly'));
  }
  return Promise.resolve({ rows: cannedRows as T[], rowCount: cannedRows.length });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

beforeEach(() => {
  captured.length = 0;
  cannedRows = [];
  shouldThrow = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getHistoricalPerformanceSummary', () => {
  it('returns null when there is no historical data yet (fresh / cleared platform)', async () => {
    cannedRows = [];
    const { getHistoricalPerformanceSummary } = await import('./performance-insights');
    const result = await getHistoricalPerformanceSummary();
    expect(result).toBeNull();
  });

  it('fails soft (returns null, never throws) on a DB error', async () => {
    shouldThrow = true;
    const { getHistoricalPerformanceSummary } = await import('./performance-insights');
    await expect(getHistoricalPerformanceSummary()).resolves.toBeNull();
  });

  it('aggregates rows into a ranked summary, grouped by niche/template/preset', async () => {
    cannedRows = [
      {
        niche: 'arbre à chat premium',
        template: 'mono',
        design_preset: 'lifestyle-warm',
        campaign_count: '8',
        store_count: '2',
        total_spend_eur: '400',
        total_revenue_eur: '1600',
        total_conversions: '32',
      },
      {
        niche: 'veilleuse enfant',
        template: 'collection-grid',
        design_preset: 'gen-z-bold',
        campaign_count: '2',
        store_count: '1',
        total_spend_eur: '100',
        total_revenue_eur: '150',
        total_conversions: '5',
      },
    ];

    const { getHistoricalPerformanceSummary } = await import('./performance-insights');
    const result = await getHistoricalPerformanceSummary();
    expect(result).not.toBeNull();
    expect(result!.groups).toHaveLength(2);
    expect(result!.totalCampaigns).toBe(10);

    const top = result!.groups[0]!;
    expect(top.niche).toBe('arbre à chat premium');
    expect(top.template).toBe('mono');
    expect(top.designPreset).toBe('lifestyle-warm');
    expect(top.campaignCount).toBe(8);
    expect(top.storeCount).toBe(2);
    expect(top.avgRoas).toBeCloseTo(4, 5); // 1600 / 400
    expect(top.avgSpendEur).toBeCloseTo(50, 5); // 400 / 8
    expect(top.totalConversions).toBe(32);

    const second = result!.groups[1]!;
    expect(second.avgRoas).toBeCloseTo(1.5, 5); // 150 / 100
  });

  it('queries dropship_ad_campaigns joined to dropship_stores, filtered to active/paused with spend', async () => {
    cannedRows = [];
    const { getHistoricalPerformanceSummary } = await import('./performance-insights');
    await getHistoricalPerformanceSummary();
    const sql = captured[0]!.sql;
    expect(sql).toMatch(/dropship_ad_campaigns/);
    expect(sql).toMatch(/JOIN dropship_stores/);
    expect(sql).toMatch(/status IN \('active', 'paused'\)/);
    expect(sql).toMatch(/GROUP BY/i);
  });

  it('handles a null design_preset without throwing', async () => {
    cannedRows = [
      {
        niche: 'gadget cuisine',
        template: 'auto',
        design_preset: null,
        campaign_count: '1',
        store_count: '1',
        total_spend_eur: '20',
        total_revenue_eur: '10',
        total_conversions: '1',
      },
    ];
    const { getHistoricalPerformanceSummary } = await import('./performance-insights');
    const result = await getHistoricalPerformanceSummary();
    expect(result!.groups[0]!.designPreset).toBeNull();
    expect(result!.groups[0]!.avgRoas).toBeCloseTo(0.5, 5);
  });
});

describe('formatHistoricalPerformanceForPrompt', () => {
  it('returns an empty string for a null summary (no section injected)', async () => {
    const { formatHistoricalPerformanceForPrompt } = await import('./performance-insights');
    expect(formatHistoricalPerformanceForPrompt(null)).toBe('');
  });

  it('returns an empty string for an empty-groups summary', async () => {
    const { formatHistoricalPerformanceForPrompt } = await import('./performance-insights');
    expect(formatHistoricalPerformanceForPrompt({ groups: [], totalCampaigns: 0 })).toBe('');
  });

  it('renders an advisory block with a low-sample caveat when N is small', async () => {
    const { formatHistoricalPerformanceForPrompt } = await import('./performance-insights');
    const text = formatHistoricalPerformanceForPrompt({
      totalCampaigns: 2,
      groups: [
        {
          niche: 'veilleuse enfant',
          template: 'collection-grid',
          designPreset: 'gen-z-bold',
          campaignCount: 2,
          storeCount: 1,
          avgRoas: 1.5,
          avgSpendEur: 50,
          totalConversions: 5,
        },
      ],
    });
    expect(text).toContain('Signal historique plateforme');
    expect(text).toContain('veilleuse enfant');
    expect(text).toContain('collection-grid');
    expect(text).toContain('gen-z-bold');
    expect(text).toMatch(/échantillon faible/);
    expect(text).toMatch(/PONDÉRER/);
  });

  it('omits the low-sample caveat wording when N is comfortably large', async () => {
    const { formatHistoricalPerformanceForPrompt } = await import('./performance-insights');
    const text = formatHistoricalPerformanceForPrompt({
      totalCampaigns: 12,
      groups: [
        {
          niche: 'arbre à chat premium',
          template: 'mono',
          designPreset: 'lifestyle-warm',
          campaignCount: 12,
          storeCount: 3,
          avgRoas: 4,
          avgSpendEur: 50,
          totalConversions: 32,
        },
      ],
    });
    expect(text).not.toMatch(/échantillon faible/);
    expect(text).toContain('N=12 campagnes');
  });
});
