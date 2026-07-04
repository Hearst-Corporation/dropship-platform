import { describe, it, expect } from 'vitest';
import { DESIGN_PRESETS, getPreset, buildPaletteFromPreset } from '@/lib/design/presets';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

describe('presets', () => {
  it('has 25 presets (5 original + 20 new)', () => {
    expect(DESIGN_PRESETS.length).toBe(25);
  });

  it('has unique slugs', () => {
    const slugs = DESIGN_PRESETS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(DESIGN_PRESETS.map((p) => [p.slug, p] as const))(
    '%s has valid required fields',
    (_slug, preset) => {
      expect(preset.slug).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.tagline.length).toBeGreaterThan(0);
      expect(Array.isArray(preset.suitedFor)).toBe(true);

      expect(preset.fonts.display.family).toBeTruthy();
      expect(preset.fonts.display.weights.length).toBeGreaterThan(0);
      expect(preset.fonts.body.family).toBeTruthy();
      expect(preset.fonts.body.weights.length).toBeGreaterThan(0);

      for (const key of ['bg', 'surface', 'text', 'textMuted', 'border'] as const) {
        expect(preset.neutrals[key]).toMatch(HEX_RE);
      }

      expect(preset.imageryMood.length).toBeGreaterThan(0);
      expect(['sharp', 'soft', 'pill']).toContain(preset.ui.radius);
      expect(['low', 'medium', 'high']).toContain(preset.ui.contrast);
      expect(typeof preset.ui.headingTracking).toBe('number');
    },
  );

  it('getPreset falls back to the first preset for unknown slugs', () => {
    expect(getPreset('does-not-exist')).toBe(DESIGN_PRESETS[0]);
    expect(getPreset(null)).toBe(DESIGN_PRESETS[0]);
    expect(getPreset(undefined)).toBe(DESIGN_PRESETS[0]);
  });

  it('getPreset resolves each new preset by slug', () => {
    const newSlugs = [
      'gadget-graphite',
      'pet-playful',
      'gourmet-noir',
      'home-linen',
      'kids-crayon',
      'jewel-mono',
      'trail-forge',
      'auto-carbon',
      'urban-concrete',
      'gift-ribbon',
      'scandi-minimal',
      'art-deco-glam',
      'brutal-neon',
      'y2k-pastel',
      'mono-architect',
      'botanical-green',
      'coastal-nautical',
      'diner-retro',
      'wabi-sabi',
      'desert-terracotta',
    ];
    for (const slug of newSlugs) {
      expect(getPreset(slug).slug).toBe(slug);
    }
  });

  it('buildPaletteFromPreset merges per-store colors onto any preset neutrals', () => {
    const preset = getPreset('gadget-graphite');
    const palette = buildPaletteFromPreset(preset, '#38bdf8', '#22d3ee');
    expect(palette.primary).toBe('#38bdf8');
    expect(palette.accent).toBe('#22d3ee');
    expect(palette.bg).toBe(preset.neutrals.bg);
    expect(palette.text).toBe(preset.neutrals.text);
  });
});
