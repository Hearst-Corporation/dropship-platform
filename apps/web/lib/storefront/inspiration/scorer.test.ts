import { describe, it, expect } from 'vitest';
import { scorePatternForDropship } from './scorer';
import type { ProductContext } from './types';

const physicalMono: ProductContext = { physical: true, mode: 'mono', hasLifestyleImages: true };

describe('scorePatternForDropship', () => {
  it('récompense un hero produit clair avec CTA above-fold + mobile propre', () => {
    const { score, usable } = scorePatternForDropship(
      {
        patternType: 'offer',
        sectionOrder: ['hero', 'offer', 'faq', 'social_proof'],
        density: 'balanced',
        ctaPlacement: 'above_fold',
        imageStrategy: 'product_cutout',
        mobileBehavior: 'sticky_cta',
      },
      physicalMono,
    );
    expect(score).toBeGreaterThanOrEqual(70);
    expect(usable).toBe(true);
  });

  it('dégrade fortement un pattern SaaS pur', () => {
    const { score, usable } = scorePatternForDropship(
      {
        patternType: 'hero',
        sectionOrder: ['hero', 'specs'],
        density: 'balanced',
        ctaPlacement: 'inline',
        imageStrategy: 'none',
        mobileBehavior: 'unknown',
        notes: 'SaaS dashboard with pricing tier and free trial, app screenshot, logo cloud',
      },
      physicalMono,
    );
    expect(score).toBeLessThan(50);
    expect(usable).toBe(false);
  });

  it('pénalise un produit non physique', () => {
    const physical = scorePatternForDropship(
      { patternType: 'hero', sectionOrder: ['hero'], density: 'balanced', ctaPlacement: 'above_fold', imageStrategy: 'split', mobileBehavior: 'stacks_vertically' },
      { physical: true, mode: 'mono' },
    ).score;
    const nonPhysical = scorePatternForDropship(
      { patternType: 'hero', sectionOrder: ['hero'], density: 'balanced', ctaPlacement: 'above_fold', imageStrategy: 'split', mobileBehavior: 'stacks_vertically' },
      { physical: false, mode: 'mono' },
    ).score;
    expect(nonPhysical).toBeLessThan(physical);
  });

  it('pénalise le décoratif impossible (webgl/parallax)', () => {
    const { penalties } = scorePatternForDropship(
      {
        patternType: 'hero',
        sectionOrder: ['hero'],
        density: 'dense',
        ctaPlacement: 'inline',
        imageStrategy: 'full_bleed',
        mobileBehavior: 'horizontal_scroll',
        notes: 'complex webgl parallax decoratif',
      },
      physicalMono,
    );
    expect(penalties.join(' ')).toMatch(/décoratif|mobile/i);
  });

  it('valorise le bundle en mini-collection, le pénalise en mono strict', () => {
    const bundleSpec = {
      patternType: 'bundle' as const,
      sectionOrder: ['hero', 'bundle', 'offer'] as import('./types').PatternType[],
      density: 'balanced' as const,
      ctaPlacement: 'above_fold' as const,
      imageStrategy: 'gallery' as const,
      mobileBehavior: 'stacks_vertically' as const,
    };
    const mini = scorePatternForDropship(bundleSpec, { physical: true, mode: 'mini_collection' }).score;
    const mono = scorePatternForDropship(bundleSpec, { physical: true, mode: 'mono' }).score;
    expect(mini).toBeGreaterThan(mono);
  });

  it('borne toujours le score dans [0, 100]', () => {
    const worst = scorePatternForDropship(
      {
        patternType: 'faq',
        sectionOrder: [],
        density: 'dense',
        ctaPlacement: 'inline',
        imageStrategy: 'none',
        mobileBehavior: 'horizontal_scroll',
        notes: 'saas dashboard api integration pricing tier logo cloud portfolio case study webgl parallax',
      },
      { physical: false, mode: 'mono' },
    ).score;
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThanOrEqual(100);
  });
});
