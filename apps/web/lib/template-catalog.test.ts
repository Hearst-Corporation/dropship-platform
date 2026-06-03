/**
 * Tests for pure helper functions in lib/template-catalog.ts
 *
 * No DB, no network — all logic is in-memory catalog lookups.
 */

import { describe, it, expect } from 'vitest';
import {
  getTemplateEntry,
  isLuxuryTemplate,
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
