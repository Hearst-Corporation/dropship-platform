/**
 * Unit coverage for the Google Ads launch planner:
 *   - deterministic fallback shape (works with NO provider at all);
 *   - OpenAI path returns a validated plan (source 'openai');
 *   - unusable model output falls back cleanly (source 'fallback');
 *   - RSA hard limits (30-char headlines, 90-char descriptions) are clamped;
 *   - staging writes the variant + draft campaign rows, and skips without a
 *     product row id.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const llm = vi.hoisted(() => ({
  responder: (() => ({
    text: '',
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    finishReason: 'stop' as string | null,
  })) as (meta: { step: string }) => { text: string; usage: unknown; finishReason: string | null },
  calls: [] as Array<{ step: string }>,
}));

vi.mock('@/lib/agent/openai-agent', () => ({
  trackedOpenAIMessage: vi.fn((meta: { step: string }) => {
    llm.calls.push({ step: meta.step });
    return Promise.resolve(llm.responder(meta));
  }),
}));

import {
  buildFallbackGoogleAdsPlan,
  generateGoogleAdsPlan,
  stageGoogleAdsPlan,
  type AdsPlanInput,
} from './ads-planner';

const INPUT: AdsPlanInput = {
  storeName: 'Lumora Wellness',
  slug: 'lumora-wellness-test',
  niche: 'home wellness aromatherapy compact beauty devices',
  brief: 'forte marge, expédition fiable, pas de claims santé',
  markets: ['FR', 'AE'],
  language: 'fr',
  landingUrl: '/shop/lumora-wellness-test',
  products: [
    { title: 'Diffuseur Aroma Zen 300ml', priceCents: 2999, costCents: 850 },
    { title: 'Roller Quartz Visage', priceCents: 1999, costCents: 480 },
  ],
};

const VALID_PLAN = {
  campaignName: 'Lumora Wellness · Lancement FR+AE',
  objective: 'Conversions achat sur le storefront',
  countries: ['FR', 'AE'],
  dailyBudgetEur: 25,
  audience: 'Adultes 25-54, intention d achat bien-être maison, mobile first.',
  keywords: ['diffuseur huiles essentielles', 'aromathérapie maison', 'roller quartz', 'bien-être maison', 'beauté visage compacte'],
  negativeKeywords: ['gratuit', 'occasion', 'emploi'],
  headlines: ['Lumora Wellness', 'Bien-être maison', 'Livraison FR + UAE', 'Qualité premium', 'Commandez maintenant'],
  descriptions: [
    'Sélection bien-être premium, expédition fiable vers la France et les Émirats.',
    'Diffuseurs et beauté compacte à forte valeur. Paiement sécurisé.',
    'Découvrez la collection Lumora et profitez des offres de lancement.',
  ],
  landingPage: '/shop/lumora-wellness-test',
  trackingNotes: ['Conversion purchase via Enhanced Conversions.'],
  policyRisks: ['Pas de claims santé sur l aromathérapie.'],
  nextSteps: ['Créer la campagne en pause puis valider le tracking.'],
};

beforeEach(() => {
  llm.calls = [];
  llm.responder = () => ({
    text: '',
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    finishReason: 'stop',
  });
});

describe('buildFallbackGoogleAdsPlan', () => {
  it('builds a complete, valid staged plan without any provider', () => {
    const plan = buildFallbackGoogleAdsPlan(INPUT);
    expect(plan.source).toBe('fallback');
    expect(plan.countries).toEqual(['FR', 'AE']);
    expect(plan.headlines.length).toBeGreaterThanOrEqual(5);
    expect(plan.descriptions.length).toBeGreaterThanOrEqual(3);
    expect(plan.keywords.length).toBeGreaterThanOrEqual(5);
    expect(plan.negativeKeywords.length).toBeGreaterThanOrEqual(3);
    expect(plan.dailyBudgetEur).toBeGreaterThan(0);
    expect(plan.landingPage).toBe('/shop/lumora-wellness-test');
    expect(plan.policyRisks.length).toBeGreaterThan(0);
    expect(plan.nextSteps.length).toBeGreaterThan(0);
    for (const h of plan.headlines) expect(h.length).toBeLessThanOrEqual(30);
    for (const d of plan.descriptions) expect(d.length).toBeLessThanOrEqual(90);
  });

  it('defaults countries to FR when markets are empty', () => {
    const plan = buildFallbackGoogleAdsPlan({ ...INPUT, markets: [] });
    expect(plan.countries).toEqual(['FR']);
  });
});

describe('generateGoogleAdsPlan', () => {
  it('returns the model plan when the JSON payload validates', async () => {
    llm.responder = () => ({
      text: JSON.stringify(VALID_PLAN),
      usage: { prompt_tokens: 500, completion_tokens: 400, total_tokens: 900 },
      finishReason: 'stop',
    });
    const plan = await generateGoogleAdsPlan(INPUT);
    expect(plan.source).toBe('openai');
    expect(plan.campaignName).toBe(VALID_PLAN.campaignName);
    expect(llm.calls.filter((c) => c.step === 'ads-plan')).toHaveLength(1);
  });

  it('clamps RSA limits on model output (headline 30 chars, description 90 chars)', async () => {
    llm.responder = () => ({
      text: JSON.stringify({
        ...VALID_PLAN,
        headlines: ['Ce titre est beaucoup trop long pour un RSA Google', ...VALID_PLAN.headlines.slice(1)],
      }),
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      finishReason: 'stop',
    });
    const plan = await generateGoogleAdsPlan(INPUT);
    for (const h of plan.headlines) expect(h.length).toBeLessThanOrEqual(30);
    for (const d of plan.descriptions) expect(d.length).toBeLessThanOrEqual(90);
  });

  it('falls back to the deterministic plan on unusable output (after retry)', async () => {
    llm.responder = () => ({
      text: 'pas du json du tout',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      finishReason: 'stop',
    });
    const plan = await generateGoogleAdsPlan(INPUT);
    expect(plan.source).toBe('fallback');
    // 2 attempts before falling back
    expect(llm.calls.filter((c) => c.step === 'ads-plan')).toHaveLength(2);
  });

  it('falls back when the provider throws', async () => {
    llm.responder = () => {
      throw new Error('OPENAI_API_KEY is not set');
    };
    const plan = await generateGoogleAdsPlan(INPUT);
    expect(plan.source).toBe('fallback');
    expect(plan.headlines.length).toBeGreaterThanOrEqual(5);
  });
});

describe('stageGoogleAdsPlan', () => {
  it('skips staging without a product row id', async () => {
    const query = vi.fn();
    const res = await stageGoogleAdsPlan({ query }, {
      storeId: 'store-1',
      productRowId: null,
      plan: buildFallbackGoogleAdsPlan(INPUT),
    });
    expect(res).toEqual({ variantId: null, campaignId: null });
    expect(query).not.toHaveBeenCalled();
  });

  it('inserts a google variant + a draft campaign carrying the full plan', async () => {
    const captured: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn((sql: string, params?: unknown[]) => {
      captured.push({ sql, params: params ?? [] });
      if (sql.includes('INSERT INTO dropship_ad_variants')) {
        return Promise.resolve({ rows: [{ id: 'variant-1' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [{ id: 'campaign-1' }], rowCount: 1 });
    });
    const plan = buildFallbackGoogleAdsPlan(INPUT);
    const res = await stageGoogleAdsPlan({ query }, {
      storeId: 'store-1',
      productRowId: 'product-1',
      plan,
    });
    expect(res).toEqual({ variantId: 'variant-1', campaignId: 'campaign-1' });

    const variantInsert = captured.find((q) => q.sql.includes('dropship_ad_variants'));
    expect(variantInsert).toBeDefined();
    expect(variantInsert!.sql).toContain("'google'");

    const campaignInsert = captured.find((q) => q.sql.includes('dropship_ad_campaigns'));
    expect(campaignInsert).toBeDefined();
    expect(campaignInsert!.sql).toContain("'draft'");
    // push_payload carries the WHOLE plan (staged, never sent)
    const payload = JSON.parse(String(campaignInsert!.params[4]));
    expect(payload.campaignName).toBe(plan.campaignName);
    expect(payload.source).toBe('fallback');
  });

  it('never throws on DB failure (plan still lives in the report)', async () => {
    const query = vi.fn(() => Promise.reject(new Error('db down')));
    const res = await stageGoogleAdsPlan({ query }, {
      storeId: 'store-1',
      productRowId: 'product-1',
      plan: buildFallbackGoogleAdsPlan(INPUT),
    });
    expect(res).toEqual({ variantId: null, campaignId: null });
  });
});
