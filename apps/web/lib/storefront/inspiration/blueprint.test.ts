import { describe, it, expect } from 'vitest';
import {
  BLUEPRINT_ARCHETYPES,
  assertBlueprintBlocksExist,
  blockSignature,
  generateBlueprintFromPatterns,
  PATTERN_TO_BLOCK,
} from './blueprint';
import { BLOCK_TYPES, type SanitizedPattern, type ProductContext } from './types';

describe('blueprint archetypes', () => {
  it('fournit au moins 5 archétypes', () => {
    expect(BLUEPRINT_ARCHETYPES.length).toBeGreaterThanOrEqual(5);
  });

  it('chaque bloc référencé existe réellement dans le système de blocs', () => {
    for (const bp of BLUEPRINT_ARCHETYPES) {
      expect(assertBlueprintBlocksExist(bp), `${bp.id}`).toEqual([]);
    }
  });

  it('les archétypes sont structurellement DISTINCTS (pas juste une recoloration)', () => {
    const sigs = BLUEPRINT_ARCHETYPES.map(blockSignature);
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it('le mapping PatternType→BlockType ne pointe que vers des blocs connus', () => {
    const known = new Set(BLOCK_TYPES);
    for (const block of Object.values(PATTERN_TO_BLOCK)) {
      if (block != null) expect(known.has(block)).toBe(true);
    }
  });

  it('aucun archétype ne contient d’allégation santé dans ses libellés de repli', () => {
    const HEALTH = [/th[ée]rapeut/i, /anti[-\s]?inflammat/i, /gu[ée]ri/i, /soulage la douleur/i, /cliniquement prouv/i];
    const blob = JSON.stringify(BLUEPRINT_ARCHETYPES);
    for (const re of HEALTH) expect(blob).not.toMatch(re);
  });
});

describe('generateBlueprintFromPatterns', () => {
  function sanitized(partial: Partial<SanitizedPattern>): SanitizedPattern {
    return {
      id: 'sp',
      sourceId: 's',
      patternType: 'hero',
      layoutSignature: 'hero split',
      sectionOrder: ['hero', 'benefit_grid', 'offer', 'faq', 'final_cta'],
      density: 'balanced',
      visualRhythm: 'airy',
      ctaPlacement: 'above_fold',
      imageStrategy: 'split',
      mobileBehavior: 'stacks_vertically',
      ecommerceUsefulnessScore: 80,
      structuralDescription: 'hero split',
      notes: '',
      sanitization: { removed: [], rawStripped: true },
      ...partial,
    };
  }

  it('choisit l’archétype bundle pour une mini-collection', () => {
    const ctx: ProductContext = { physical: true, mode: 'mini_collection' };
    const bp = generateBlueprintFromPatterns([sanitized({})], ctx);
    expect(bp.mode).toBe('mini_collection');
    expect(bp.blockOrder.some((b) => b.type === 'bundle')).toBe(true);
  });

  it('produit toujours un blueprint valide (hero + conversion)', () => {
    const ctx: ProductContext = { physical: true, mode: 'mono', hasLifestyleImages: true };
    const bp = generateBlueprintFromPatterns(
      [sanitized({ sectionOrder: ['hero', 'product_showcase', 'benefit_grid', 'social_proof', 'offer', 'final_cta'] })],
      ctx,
    );
    expect(assertBlueprintBlocksExist(bp)).toEqual([]);
    expect(bp.derivedFromPatternIds).toContain('sp');
    expect(bp.sourceUsefulness).toBeGreaterThan(0);
  });
});
