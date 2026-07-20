import { describe, it, expect } from 'vitest';
import { sanitizeExtractedPattern, auditSanitized, scrubFreeText } from './sanitize';
import type { ExtractedPattern } from './types';

/** Pattern extrait « sale » : plein de contenu source à retirer. */
function dirtyPattern(): ExtractedPattern {
  return {
    id: 'p1',
    sourceId: 'example.com',
    patternType: 'hero',
    layoutSignature: 'hero split <div class="hero-x"> image right https://cdn.example.com/logo.png',
    sectionOrder: ['hero', 'benefit_grid', 'offer', 'faq', 'final_cta'],
    density: 'balanced',
    visualRhythm: 'airy — see http://brand.com/style.css .brand-title',
    ctaPlacement: 'above_fold',
    imageStrategy: 'split',
    mobileBehavior: 'stacks_vertically',
    ecommerceUsefulnessScore: 72,
    notes: 'Belle page de AcmeBrand — “Change your life” — prix 49,99€',
    raw: {
      sectionTitles: ['Change your life', 'Why AcmeBrand'],
      imageUrls: ['https://cdn.example.com/hero.jpg', 'https://cdn.example.com/logo.svg'],
      brandNames: ['AcmeBrand', 'John Doe'],
      cssClasses: ['hero-x', 'btn-primary'],
      htmlSnippets: ['<section class="hero"><h1>Change your life</h1></section>'],
      prices: ['49,99€', '$39'],
      slogans: ['Change your life'],
    },
  };
}

describe('sanitizeExtractedPattern', () => {
  it('supprime totalement le champ raw (aucun contenu source ne survit)', () => {
    const clean = sanitizeExtractedPattern(dirtyPattern());
    expect('raw' in clean).toBe(false);
    expect(clean.sanitization.rawStripped).toBe(true);
  });

  it('trace les catégories retirées', () => {
    const clean = sanitizeExtractedPattern(dirtyPattern());
    expect(clean.sanitization.removed).toEqual(
      expect.arrayContaining(['section_titles', 'image_urls', 'brand_names', 'css_classes', 'html_snippets', 'prices', 'slogans']),
    );
  });

  it('retire le texte original des champs libres', () => {
    const clean = sanitizeExtractedPattern(dirtyPattern());
    const blob = JSON.stringify(clean);
    expect(blob).not.toMatch(/AcmeBrand/);
    expect(blob).not.toMatch(/Change your life/);
    expect(blob).not.toMatch(/John Doe/);
  });

  it('retire les URLs d’images', () => {
    const clean = sanitizeExtractedPattern(dirtyPattern());
    const blob = JSON.stringify(clean);
    expect(blob).not.toMatch(/https?:\/\//);
    expect(blob).not.toMatch(/\.(png|jpe?g|svg|webp)/i);
  });

  it('retire le HTML et les classes CSS', () => {
    const clean = sanitizeExtractedPattern(dirtyPattern());
    const blob = JSON.stringify(clean);
    expect(blob).not.toMatch(/<[a-z]/i);
    expect(blob).not.toMatch(/hero-x|btn-primary/);
  });

  it('retire les prix concurrents', () => {
    const clean = sanitizeExtractedPattern(dirtyPattern());
    const blob = JSON.stringify(clean);
    expect(blob).not.toMatch(/49[.,]99\s?€/);
    expect(blob).not.toMatch(/[€$£]\s?\d/);
  });

  it('GARDE la signature structurelle exploitable', () => {
    const clean = sanitizeExtractedPattern(dirtyPattern());
    expect(clean.patternType).toBe('hero');
    expect(clean.sectionOrder).toEqual(['hero', 'benefit_grid', 'offer', 'faq', 'final_cta']);
    expect(clean.density).toBe('balanced');
    expect(clean.ctaPlacement).toBe('above_fold');
    expect(clean.imageStrategy).toBe('split');
    expect(clean.structuralDescription.length).toBeGreaterThan(0);
    // La description reste lisible et structurelle.
    expect(clean.structuralDescription).toMatch(/hero/);
    expect(clean.layoutSignature).toMatch(/hero/);
  });

  it('redige le sourceId (hostname de marque) présent dans les notes', () => {
    const p = dirtyPattern();
    p.sourceId = 'nikestore.example';
    p.notes = 'Extrait structurel de nikestore.example';
    const clean = sanitizeExtractedPattern(p);
    expect(clean.notes).not.toMatch(/nikestore\.example/);
    // sourceId lui-même reste comme provenance (champ dédié, non affiché).
    expect(clean.sourceId).toBe('nikestore.example');
  });

  it('auditSanitized ne trouve aucune violation sur un pattern nettoyé', () => {
    const clean = sanitizeExtractedPattern(dirtyPattern());
    expect(auditSanitized(clean)).toEqual([]);
  });

  it('auditSanitized détecte une violation injectée (garde-fou du garde-fou)', () => {
    const clean = sanitizeExtractedPattern(dirtyPattern());
    const tampered = { ...clean, notes: 'voir https://leak.example.com/x.png' };
    expect(auditSanitized(tampered).length).toBeGreaterThan(0);
  });
});

describe('scrubFreeText', () => {
  it('neutralise URLs, HTML, images, prix, classes', () => {
    const out = scrubFreeText('<b>Buy</b> at https://x.com/y.png for 19,99€ .promo-btn #hero');
    expect(out).not.toMatch(/<b>/);
    expect(out).not.toMatch(/https?:\/\//);
    expect(out).not.toMatch(/[€$£]\s?\d/);
    expect(out).not.toMatch(/promo-btn/);
  });
});
