import { describe, it, expect } from 'vitest';
import { resolveMonoLandingCopy, resolveLuxuryLandingCopy } from '@/lib/design/landing-copy';
import type { StoreConfig } from '@/lib/store-config';

describe('landing-copy', () => {
  it('merges luxury_copy into mono hero fields', () => {
    const store = {
      tagline: 'Tagline',
      landingContent: {
        hero: { kicker: 'std', lede: 'std lede' },
        luxury_copy: { hero_eyebrow: 'Maison', hero_lede: 'Luxe lede' },
      },
    } as unknown as StoreConfig;

    const copy = resolveMonoLandingCopy(store);
    expect(copy.heroKicker).toBe('Maison');
    expect(copy.heroLede).toBe('Luxe lede');
  });

  it('uses atelier_pillars as selling points when present', () => {
    const store = {
      landingContent: {
        luxury_copy: {
          atelier_pillars: [{ title: 'Craft', body: 'Hand made' }],
        },
      },
    } as unknown as StoreConfig;

    expect(resolveLuxuryLandingCopy(store).sellingPoints).toEqual([
      { title: 'Craft', body: 'Hand made' },
    ]);
  });
});
