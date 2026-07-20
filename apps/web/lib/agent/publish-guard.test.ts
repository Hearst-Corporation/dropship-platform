import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ getDbRead: () => ({ query }) }));

const stripeIsLive = vi.hoisted(() => vi.fn());
const checkoutVerified = vi.hoisted(() => vi.fn());
vi.mock('@/lib/stripe-env', () => ({ stripeIsLive, checkoutVerified }));

import { evaluatePublishGuard } from './publish-guard';

function mockStore(row: Record<string, unknown>, products: Record<string, unknown>[]) {
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: [row] }) // store
    .mockResolvedValueOnce({ rows: products }); // products
}

describe('evaluatePublishGuard', () => {
  beforeEach(() => {
    stripeIsLive.mockReturnValue(false);
    checkoutVerified.mockReturnValue(false);
  });

  it('passes a clean store (test-mode stripe, persisted image, real template)', async () => {
    mockStore(
      { template: 'tech-modular', landing_content: { hero: { lede: 'un objet premium' } } },
      [{ supplier: 'aliexpress', image_url: 'https://pub-abc.r2.dev/s/products/x.webp' }],
    );
    const r = await evaluatePublishGuard('s1');
    expect(r.ok).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it('blocks live stripe checkout that is not verified', async () => {
    stripeIsLive.mockReturnValue(true);
    mockStore(
      { template: 'tech-modular', landing_content: {} },
      [{ supplier: 'aliexpress', image_url: 'https://pub-abc.r2.dev/x.webp' }],
    );
    const r = await evaluatePublishGuard('s1');
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => /Stripe LIVE/i.test(b))).toBe(true);
  });

  it('allows live stripe when explicitly verified', async () => {
    stripeIsLive.mockReturnValue(true);
    checkoutVerified.mockReturnValue(true);
    mockStore(
      { template: 'tech-modular', landing_content: {} },
      [{ supplier: 'aliexpress', image_url: 'https://pub-abc.r2.dev/x.webp' }],
    );
    const r = await evaluatePublishGuard('s1');
    expect(r.blockers.some((b) => /Stripe LIVE/i.test(b))).toBe(false);
  });

  it('blocks a hotlinked supplier image', async () => {
    mockStore(
      { template: 'tech-modular', landing_content: {} },
      [{ supplier: 'aliexpress', image_url: 'https://ae-pic-a1.aliexpress-media.com/kf/x.jpg' }],
    );
    const r = await evaluatePublishGuard('s1');
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => /hotlink/i.test(b))).toBe(true);
  });

  it('blocks health/therapeutic claims in the copy', async () => {
    mockStore(
      { template: 'tech-modular', landing_content: { hero: { lede: 'soulage la douleur en profondeur' } } },
      [{ supplier: 'aliexpress', image_url: 'https://pub-abc.r2.dev/x.webp' }],
    );
    const r = await evaluatePublishGuard('s1');
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => /Claims sant/i.test(b))).toBe(true);
  });

  it('blocks the generic `auto` template', async () => {
    mockStore(
      { template: 'auto', landing_content: {} },
      [{ supplier: 'aliexpress', image_url: 'https://pub-abc.r2.dev/x.webp' }],
    );
    const r = await evaluatePublishGuard('s1');
    expect(r.blockers.some((b) => /g[ée]n[ée]rique/i.test(b))).toBe(true);
  });

  it('blocks an AI-fallback product', async () => {
    mockStore(
      { template: 'tech-modular', landing_content: {} },
      [{ supplier: 'ai-generated', image_url: 'https://pub-abc.r2.dev/x.webp' }],
    );
    const r = await evaluatePublishGuard('s1');
    expect(r.blockers.some((b) => /fallback IA/i.test(b))).toBe(true);
  });
});
