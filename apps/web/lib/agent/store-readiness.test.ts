import { describe, expect, it, vi, beforeEach } from 'vitest';
import { evaluateStoreReadiness, detectSmartComponents } from './store-readiness';

interface MockStoreOverrides {
  name?: string;
  niche?: string;
  slug?: string;
  mode?: 'mono' | 'collection';
  template?: string;
  hero_image_url?: string | null;
  cutout_image_url?: string | null;
  medusa_sales_channel_id?: string | null;
  medusa_publishable_key?: string | null;
  landing_content?: Record<string, unknown> | null;
  status?: string;
  assets_status?: string;
}

interface MockProduct {
  id: string;
  enriched_title: string;
  enriched_description: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  medusa_product_id: string | null;
  supplier: string;
  external_id: string;
  image_quality_score?: number | null;
}

function mockStore(overrides: MockStoreOverrides = {}): Record<string, unknown> {
  return {
    id: 'store-1',
    name: 'Test Store',
    niche: 'yoga',
    slug: 'test-store',
    mode: 'collection',
    template: 'collection-grid',
    hero_image_url: null,
    cutout_image_url: null,
    lifestyle_images: [],
    promo_video_url: null,
    medusa_sales_channel_id: 'sc_1',
    medusa_publishable_key: 'pk_1',
    landing_content: {
      hero: { headline_html: 'Hello' },
      selling_points: [{ title: 'A', body: 'a' }],
      trust_promises: [{ title: 'B', body: 'b' }],
    },
    status: 'generating',
    product_count: 0,
    assets_status: 'none',
    ...overrides,
  };
}

function mockProduct(overrides: Partial<MockProduct> = {}): MockProduct {
  return {
    id: 'p1',
    enriched_title: 'Tapis Yoga',
    enriched_description: 'desc',
    price_cents: 2199,
    cost_cents: 800,
    image_url: 'https://example.com/img.jpg',
    medusa_product_id: 'med_1',
    supplier: 'aliexpress',
    external_id: 'ae-1',
    ...overrides,
  };
}

const mockQuery = vi.fn();

vi.mock('@/lib/db', () => ({
  getDbRead: () => ({ query: mockQuery }),
}));

describe('evaluateStoreReadiness', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('blocks a store with 0 products', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [mockStore()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await evaluateStoreReadiness('store-1');
    expect(result.canPublish).toBe(false);
    expect(result.blockers).toContain('Aucun produit');
  });

  it('blocks a store without Medusa channel', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [mockStore({ medusa_sales_channel_id: null })], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [mockProduct()], rowCount: 1 });
    const result = await evaluateStoreReadiness('store-1');
    expect(result.canPublish).toBe(false);
    expect(result.blockers).toContain('Canal de vente Medusa non configuré');
  });

  it('blocks a mono store without hero image', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [mockStore({ mode: 'mono', template: 'mono' })], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [mockProduct()], rowCount: 1 });
    const result = await evaluateStoreReadiness('store-1');
    expect(result.canPublish).toBe(false);
    expect(result.blockers).toContain('Hero image manquante (obligatoire en mode mono)');
  });

  it('allows a complete collection store', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [mockStore({ hero_image_url: 'https://example.com/hero.jpg', status: 'ready' })], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          mockProduct(),
          mockProduct({ id: 'p2', external_id: 'ae-2' }),
          mockProduct({ id: 'p3', external_id: 'ae-3' }),
          mockProduct({ id: 'p4', external_id: 'ae-4' }),
        ],
        rowCount: 4,
      });
    const result = await evaluateStoreReadiness('store-1');
    expect(result.canPublish).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.score).toBeGreaterThan(80);
  });

  it('warns when landing content is missing smart components', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [mockStore({ landing_content: { hero: { kicker: 'x' } } })], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [mockProduct()], rowCount: 1 });
    const result = await evaluateStoreReadiness('store-1');
    expect(result.warnings.some((w) => w.includes('Smart components'))).toBe(true);
  });
});

describe('detectSmartComponents', () => {
  it('detects hero, selling_points, trust_promises', () => {
    const detected = detectSmartComponents({
      hero: { kicker: 'x' },
      selling_points: [{ title: 'A', body: 'a' }],
      trust_promises: [{ title: 'B', body: 'b' }],
    });
    expect(detected).toContain('hero');
    expect(detected).toContain('selling_points');
    expect(detected).toContain('trust_promises');
  });

  it('returns empty for null', () => {
    expect(detectSmartComponents(null)).toEqual([]);
  });
});
