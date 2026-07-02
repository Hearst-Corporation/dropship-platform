/**
 * Run-report persistence: platform_settings KV roundtrip (save upsert + load),
 * corruption tolerance, and never-throw guarantees.
 */

import { describe, expect, it, vi } from 'vitest';
import { loadStoreReport, saveStoreReport, type StoreRunReport } from './store-report';

function makeReport(): StoreRunReport {
  return {
    version: 1,
    storeId: 'store-uuid-1',
    storeName: 'Lumora Wellness',
    slug: 'lumora-wellness-abc',
    niche: 'home wellness',
    mode: 'collection',
    language: 'fr',
    template: 'wellness-soft',
    brief: 'forte marge, expédition fiable',
    markets: ['FR', 'AE'],
    suppliers: [
      { id: 'aliexpress', label: 'AliExpress', tier: 'v1', status: 'active', considered: true, eligible: true, productsFound: 12, reason: '12 produits retenus' },
      { id: 'alibaba', label: 'Alibaba (classic)', status: 'excluded', considered: false, eligible: false, productsFound: 0, reason: 'MOQ eleve' },
    ],
    products: [
      { externalId: 'AE1', supplier: 'aliexpress', title: 'Diffuseur Zen', priceCents: 2999, costCents: 850, marginPct: 72, riskLevel: 'low', marketFit: 'FR + UAE ok', status: 'imported', reason: 'Best-seller niche', imageUrl: 'https://img/1.jpg' },
    ],
    assets: { status: 'supplier-images', notes: 'Photos fournisseur qualifiées.' },
    adsPlan: null,
    events: [{ ts: '2026-07-02T10:00:00.000Z', type: 'step', message: 'Démarrage' }],
    createdAt: '2026-07-02T10:00:00.000Z',
  };
}

describe('saveStoreReport / loadStoreReport', () => {
  it('roundtrips through the platform_settings KV', async () => {
    const kv = new Map<string, string>();
    const db = {
      query: vi.fn((sql: string, params?: unknown[]) => {
        if (sql.startsWith('INSERT INTO platform_settings')) {
          kv.set(String(params![0]), String(params![1]));
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        const value = kv.get(String(params![0]));
        return Promise.resolve({ rows: value ? [{ value }] : [], rowCount: value ? 1 : 0 });
      }),
    };

    const report = makeReport();
    expect(await saveStoreReport(db, report)).toBe(true);
    expect(kv.has('store_report:store-uuid-1')).toBe(true);

    const loaded = await loadStoreReport(db, 'store-uuid-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.storeName).toBe('Lumora Wellness');
    expect(loaded!.markets).toEqual(['FR', 'AE']);
    expect(loaded!.suppliers).toHaveLength(2);
    expect(loaded!.products[0]!.marginPct).toBe(72);
  });

  it('returns null when no report exists', async () => {
    const db = { query: vi.fn(() => Promise.resolve({ rows: [], rowCount: 0 })) };
    expect(await loadStoreReport(db, 'missing')).toBeNull();
  });

  it('returns null on corrupted JSON instead of throwing', async () => {
    const db = { query: vi.fn(() => Promise.resolve({ rows: [{ value: '{broken' }], rowCount: 1 })) };
    expect(await loadStoreReport(db, 'store-uuid-1')).toBeNull();
  });

  it('save never throws on DB failure', async () => {
    const db = { query: vi.fn(() => Promise.reject(new Error('db down'))) };
    expect(await saveStoreReport(db, makeReport())).toBe(false);
  });
});
