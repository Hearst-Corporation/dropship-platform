/**
 * Tests for pure helper functions in lib/template-catalog.ts
 *
 * No DB, no network — all logic is in-memory catalog lookups.
 */

import { describe, it, expect } from 'vitest';
import {
  getTemplateEntry,
  isLuxuryTemplate,
  suggestTemplate,
  TEMPLATE_CATALOG,
  TEMPLATE_IDS,
} from './template-catalog';

// ── getTemplateEntry ────────────────────────────────────────────────────────

describe('getTemplateEntry', () => {
  it('returns the entry for a known id', () => {
    const entry = getTemplateEntry('mono');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('mono');
    expect(entry!.label).toBeTruthy();
  });

  it('returns undefined for an unknown id', () => {
    expect(getTemplateEntry('does-not-exist')).toBeUndefined();
  });

  it('returns the "auto" entry', () => {
    const entry = getTemplateEntry('auto');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('auto');
  });

  it('returns the correct entry for a wix-batch template', () => {
    const entry = getTemplateEntry('wellness-retreat');
    expect(entry).toBeDefined();
    expect(entry!.register).toBe('premium');
  });

  it('all TEMPLATE_IDS resolve via getTemplateEntry', () => {
    for (const id of TEMPLATE_IDS) {
      const entry = getTemplateEntry(id as string);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
    }
  });
});

// ── isLuxuryTemplate ───────────────────────────────────────────────────────

describe('isLuxuryTemplate', () => {
  it('returns true for luxury-minimal', () => {
    expect(isLuxuryTemplate('luxury-minimal')).toBe(true);
  });

  it('returns true for luxury-mono', () => {
    expect(isLuxuryTemplate('luxury-mono')).toBe(true);
  });

  it('returns true for fiora-locks-wh1270 (luxury register)', () => {
    expect(isLuxuryTemplate('fiora-locks-wh1270')).toBe(true);
  });

  it('returns false for a premium template (not luxury)', () => {
    expect(isLuxuryTemplate('mono')).toBe(false);
  });

  it('returns false for a mass-register template', () => {
    expect(isLuxuryTemplate('collection-grid')).toBe(false);
  });

  it('returns false for unknown id', () => {
    expect(isLuxuryTemplate('not-a-template')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isLuxuryTemplate(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isLuxuryTemplate(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isLuxuryTemplate('')).toBe(false);
  });

  it('exactly 3 luxury templates exist in the catalog', () => {
    const luxuryEntries = TEMPLATE_CATALOG.filter((t) => t.register === 'luxury');
    expect(luxuryEntries).toHaveLength(3);
    // All must pass isLuxuryTemplate
    for (const entry of luxuryEntries) {
      expect(isLuxuryTemplate(entry.id)).toBe(true);
    }
  });
});

// ── suggestTemplate ────────────────────────────────────────────────────────

describe('suggestTemplate', () => {
  it('picks a rich wellness/beauty/home template for an aromatherapy collection niche', () => {
    const id = suggestTemplate({
      niche: 'home wellness aromatherapy compact beauty devices',
      mode: 'collection',
      productCount: 8,
    });

    const entry = getTemplateEntry(id);
    expect(entry).toBeDefined();
    expect(
      entry!.niches.some((n) => n === 'wellness' || n === 'beauty' || n === 'home'),
    ).toBe(true);
    expect(entry!.register).not.toBe('luxury');
    expect(entry!.mode).not.toBe('mono');
    // A niche-specific rich layout must beat the generic fallbacks.
    expect(id).not.toBe('auto');
    expect(id).not.toBe('collection-grid');
  });

  it('returns the non-luxury mono template for a mono store', () => {
    const id = suggestTemplate({
      niche: 'gadget cuisine',
      mode: 'mono',
      productCount: 1,
    });

    expect(id).toBe('mono');
    const entry = getTemplateEntry(id);
    expect(entry).toBeDefined();
    expect(entry!.mode).toBe('mono');
    expect(entry!.register).not.toBe('luxury');
  });

  it('falls back to a valid non-auto, non-luxury id for an unknown niche', () => {
    const id = suggestTemplate({
      niche: 'objets divers zzz',
      mode: 'collection',
      productCount: 8,
    });

    expect(TEMPLATE_IDS).toContain(id);
    expect(id).not.toBe('auto');
    const entry = getTemplateEntry(id);
    expect(entry).toBeDefined();
    expect(entry!.register).not.toBe('luxury');
  });

  it('respects productCount: a 2-product collection only gets templates with minProducts <= 2', () => {
    const id = suggestTemplate({
      niche: 'objets divers zzz',
      mode: 'collection',
      productCount: 2,
    });

    const entry = getTemplateEntry(id);
    expect(entry).toBeDefined();
    expect(entry!.minProducts).toBeLessThanOrEqual(2);
  });

  it('never returns a luxury-register template, whatever the niche', () => {
    const niches = [
      'bijoux fashion luxe',
      'haute joaillerie maison bague collier',
      'beauté cosmétique éditoriale premium',
      'mode vêtement streetwear',
      'cadeau gifting maison déco',
      'wellness spa massage aromathérapie',
      'tech gadget audio smart',
    ];
    for (const niche of niches) {
      for (const mode of ['mono', 'collection'] as const) {
        const id = suggestTemplate({
          niche,
          mode,
          productCount: mode === 'mono' ? 1 : 8,
        });
        const entry = getTemplateEntry(id);
        expect(entry).toBeDefined();
        expect(entry!.register).not.toBe('luxury');
      }
    }
  });

  it('is deterministic: two identical calls return the same id', () => {
    const args = {
      niche: 'home wellness aromatherapy compact beauty devices',
      mode: 'collection' as const,
      productCount: 8,
    };
    expect(suggestTemplate(args)).toBe(suggestTemplate({ ...args }));
  });

  it('uses the brief to detect the niche when the niche string is neutral', () => {
    const id = suggestTemplate({
      niche: 'boutique en ligne',
      mode: 'collection',
      productCount: 6,
      brief: 'aromathérapie bien-être spa',
    });

    const entry = getTemplateEntry(id);
    expect(entry).toBeDefined();
    expect(entry!.niches).toContain('wellness');
  });
});

// ── Catalog integrity ──────────────────────────────────────────────────────

describe('TEMPLATE_CATALOG integrity', () => {
  it('every entry has a non-empty id and label', () => {
    for (const entry of TEMPLATE_CATALOG) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('all ids in TEMPLATE_IDS are unique', () => {
    const ids = [...TEMPLATE_IDS];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('minProducts is always >= 0', () => {
    for (const entry of TEMPLATE_CATALOG) {
      expect(entry.minProducts).toBeGreaterThanOrEqual(0);
    }
  });
});
