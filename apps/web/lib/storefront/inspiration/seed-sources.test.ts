import { describe, it, expect } from 'vitest';
import { SEED_SOURCES, seedSourceLooksClean } from './seed-sources';
import { collectFromManualCapture } from './collector';
import { sanitizeExtractedPattern, auditSanitized } from './sanitize';

describe('seed-sources registry', () => {
  it('ne transporte AUCUN contenu copié (ni HTML, ni style, ni asset image)', () => {
    for (const s of SEED_SOURCES) {
      expect(seedSourceLooksClean(s), s.hint).toBe(true);
    }
    const blob = JSON.stringify(SEED_SOURCES);
    expect(blob).not.toMatch(/<[a-z]/i); // pas de HTML
    expect(blob).not.toMatch(/\.(png|jpe?g|webp|svg)\b/i); // pas d'asset image
  });

  it('déclare toujours un usage autorisé ET un usage interdit', () => {
    for (const s of SEED_SOURCES) {
      expect(s.allowedUse.length).toBeGreaterThan(0);
      expect(s.forbiddenUse).toMatch(/images|textes|classes|logos/i);
    }
  });
});

describe('collectFromManualCapture → sanitize', () => {
  it('la note opérateur (texte source) disparaît après sanitize', () => {
    const [pattern] = collectFromManualCapture({
      sourceId: 'capture-1',
      idPrefix: 'cap',
      nicheHint: 'beauty',
      sections: [{ patternType: 'hero', operatorNote: 'Marque XYZ — slogan copié', imageStrategy: 'full_bleed' }],
    });
    const clean = sanitizeExtractedPattern(pattern);
    expect(JSON.stringify(clean)).not.toMatch(/XYZ|slogan copié/);
    expect(auditSanitized(clean)).toEqual([]);
    // La structure survit.
    expect(clean.patternType).toBe('hero');
    expect(clean.imageStrategy).toBe('full_bleed');
  });
});
