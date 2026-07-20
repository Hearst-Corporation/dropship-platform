import { describe, it, expect } from 'vitest';
import { STOREFRONT_BLUEPRINTS, resolveBlueprint, getBlueprint } from './blueprint-templates';
import { assertBlueprintBlocksExist, blockSignature } from './inspiration/blueprint';
import type { TemplateBlueprint } from './inspiration/types';
import type { StoreConfig } from '@/lib/store-config';

/**
 * Strings qui ATTEIGNENT réellement le DOM (kicker/titre/note/CTA + copie de
 * repli). Exclut volontairement qaRules/copySlots/name/niche — guidance interne
 * jamais rendue (les qaRules citent des phrases interdites à titre d'exemple).
 */
function userVisibleStrings(bp: TemplateBlueprint): string[] {
  const out: string[] = [];
  for (const s of bp.blockOrder) {
    for (const v of [s.kicker, s.title, s.note, s.ctaLabel]) if (v) out.push(v);
    const f = s.fallback;
    if (f) {
      if (f.problem) out.push(f.problem);
      if (f.comparisonTheirs) out.push(f.comparisonTheirs);
      for (const it of [...(f.faq ?? []), ...(f.objections ?? [])]) out.push(it.q, it.a);
    }
  }
  return out;
}

function store(partial: Partial<Pick<StoreConfig, 'template' | 'niche' | 'mode'>>): Pick<StoreConfig, 'template' | 'niche' | 'mode'> {
  return { template: 'auto' as StoreConfig['template'], niche: '', mode: 'mono', ...partial };
}

describe('STOREFRONT_BLUEPRINTS', () => {
  it('expose 7 templates', () => {
    expect(STOREFRONT_BLUEPRINTS.length).toBe(7);
  });

  it('chaque template ne référence que des blocs existants + a hero + conversion', () => {
    for (const bp of STOREFRONT_BLUEPRINTS) {
      expect(assertBlueprintBlocksExist(bp), bp.id).toEqual([]);
    }
  });

  it('les 7 templates sont structurellement DISTINCTS (pas de simple recoloration)', () => {
    const sigs = STOREFRONT_BLUEPRINTS.map(blockSignature);
    expect(new Set(sigs).size).toBe(7);
  });

  it('la différenciation porte sur plusieurs axes (hero / densité / offre)', () => {
    // Au moins 2 styles de hero, 3 densités possibles, 3+ stratégies d'offre.
    expect(new Set(STOREFRONT_BLUEPRINTS.map((b) => b.heroStyle)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(STOREFRONT_BLUEPRINTS.map((b) => b.contentDensity)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(STOREFRONT_BLUEPRINTS.map((b) => b.offerStrategy)).size).toBeGreaterThanOrEqual(3);
  });

  it('AUCUN libellé rendu ne contient d’allégation santé', () => {
    const HEALTH = [
      /th[ée]rapeut/i,
      /anti[-\s]?inflammat/i,
      /gu[ée]ri/i,
      /soigne\b/i,
      /soulage la douleur/i,
      /cliniquement prouv/i,
      /certifi[ée] m[ée]dical/i,
    ];
    const blob = STOREFRONT_BLUEPRINTS.flatMap(userVisibleStrings).join('  ');
    for (const re of HEALTH) expect(blob, re.source).not.toMatch(re);
  });

  it('AUCUN contenu copié : pas de HTML, pas d’URL externe, pas d’asset image', () => {
    const blob = JSON.stringify(STOREFRONT_BLUEPRINTS);
    expect(blob).not.toMatch(/<[a-z][^>]*>/i); // pas de balise HTML
    expect(blob).not.toMatch(/https?:\/\//i); // pas d'URL externe
    expect(blob).not.toMatch(/\.(png|jpe?g|webp|svg)\b/i); // pas d'asset image
    // Les seuls href autorisés sont internes.
    const hrefs = STOREFRONT_BLUEPRINTS.flatMap((b) => b.blockOrder.map((s) => s.ctaHref).filter(Boolean));
    for (const h of hrefs) expect(h!).toMatch(/^(\/|#)/);
  });
});

describe('resolveBlueprint', () => {
  const cases: Array<[Partial<Pick<StoreConfig, 'template' | 'niche' | 'mode'>>, string]> = [
    [{ niche: 'sérum visage beauty' }, 'beauty-wellness-no-claims'],
    [{ niche: 'gamelle pour chien' }, 'pet-home-practical'],
    [{ niche: 'accessoire maison salon' }, 'pet-home-practical'],
    [{ niche: 'sac à main mode' }, 'fashion-accessory-editorial'],
    [{ niche: 'récupération sport fitness' }, 'sport-recovery-performance'],
    [{ niche: 'gadget tech innovation' }, 'gadget-impulse-premium'],
    [{ niche: 'pack coffret duo' }, 'mini-collection-bundle'],
    [{ niche: 'quelque chose de neutre' }, 'mono-premium-tech'],
    [{ niche: 'catalogue varié', mode: 'collection' }, 'mini-collection-bundle'],
  ];
  it.each(cases)('mappe %o → %s', (input, expected) => {
    expect(resolveBlueprint(store(input)).id).toBe(expected);
  });

  it('préserve les mappings historiques beauty / pet-home / mono par défaut', () => {
    expect(resolveBlueprint(store({ niche: 'wellness bien-être' })).id).toBe('beauty-wellness-no-claims');
    expect(resolveBlueprint(store({ niche: 'foyer cuisine' })).id).toBe('pet-home-practical');
    expect(resolveBlueprint(store({ template: 'auto' as StoreConfig['template'], niche: '' })).id).toBe('mono-premium-tech');
  });

  it('getBlueprint retrouve chaque template par id', () => {
    for (const bp of STOREFRONT_BLUEPRINTS) {
      expect(getBlueprint(bp.id)?.id).toBe(bp.id);
    }
  });
});
