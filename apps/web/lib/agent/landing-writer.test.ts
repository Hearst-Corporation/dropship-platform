/**
 * Year sanitisation of generated landing copy. The LLM prompt forbids
 * years but models still leak stale ones ("NOUVEAU · 2023" seen in QA);
 * stripYears/sanitizeLandingContent are the deterministic guarantee that
 * nothing dated reaches dropship_stores.landing_content.
 */

import { describe, expect, it } from 'vitest';
import {
  sanitizeLandingContent,
  stripYears,
  type LandingContent,
} from './landing-writer';

describe('stripYears', () => {
  it('removes a year glued to a kicker separator', () => {
    expect(stripYears('NOUVEAU · 2023')).toBe('NOUVEAU');
    expect(stripYears('Nouveau · 2024')).toBe('Nouveau');
    expect(stripYears('2026 · Édition limitée')).toBe('Édition limitée');
  });

  it('removes a year in the middle of a headline and keeps the sentence readable', () => {
    expect(stripYears('La précision de 2024 dans ta poche')).toBe(
      'La précision dans ta poche',
    );
    expect(stripYears('Pensé pour 2025 et les saisons qui suivent')).toBe(
      'Pensé et les saisons qui suivent',
    );
  });

  it('drops "Depuis <année>" openers and restores the leading capital', () => {
    expect(stripYears('Depuis 2024, un savoir-faire transmis')).toBe(
      'Un savoir-faire transmis',
    );
  });

  it('collapses doubled separators left by a removed year', () => {
    expect(stripYears('Atelier · 2023 · Pièce signature')).toBe(
      'Atelier · Pièce signature',
    );
  });

  it('keeps legitimate mid-string separators between surviving segments', () => {
    expect(stripYears('Nouveau · Édition 2026')).toBe('Nouveau · Édition');
  });

  it('returns text without a year strictly unchanged', () => {
    const samples = [
      'Livraison rapide en France',
      'Nouveau · Édition atelier',
      'Un objet <em>précis</em>, pensé pour durer.',
      '',
    ];
    for (const s of samples) expect(stripYears(s)).toBe(s);
  });

  it('does not touch numeric HTML entities', () => {
    expect(stripYears('Édition &#2024; limitée')).toBe('Édition &#2024; limitée');
    expect(stripYears('L&#8217;objet, depuis 2023, patiné')).toBe(
      'L&#8217;objet, patiné',
    );
  });

  it('preserves <em> markup and cleans an <em> emptied by the removal', () => {
    expect(stripYears('Un objet <em>précis</em>, pensé pour 2025')).toBe(
      'Un objet <em>précis</em>, pensé',
    );
    expect(stripYears('Collection <em>2024</em> signature')).toBe(
      'Collection signature',
    );
  });

  it('does not touch 4-digit numbers embedded in longer digit runs', () => {
    expect(stripYears('Batterie 20240 mAh, année 2024 oubliée')).toBe(
      'Batterie 20240 mAh, année oubliée',
    );
  });

  it('is idempotent', () => {
    const once = stripYears('Depuis 2024, NOUVEAU · 2023');
    expect(stripYears(once)).toBe(once);
  });
});

describe('sanitizeLandingContent', () => {
  it('cleans every text slot of the standard content', () => {
    const content: LandingContent = {
      hero: {
        kicker: 'NOUVEAU · 2023',
        headline_html: 'La lampe <em>2024</em> qui suit ta lecture',
        lede: 'Depuis 2024, une lumière stable pour lire tard.',
      },
      selling_points: [
        { title: 'Autonomie 80 h', body: 'Conçue en 2023 pour tenir un mois.' },
        { title: 'Charge USB-C', body: 'Pleine charge en 90 minutes.' },
      ],
      showcase: {
        kicker: 'L\'objet',
        headline_html: 'Un halo <em>précis</em>',
        lede: 'Édition 2025 pensée pour le soir.',
      },
      final_cta: { kicker: 'Prêt ?', headline_html: 'Lis <em>mieux</em> dès 2026' },
      trust_promises: [{ title: 'Essai 30 jours', body: 'Retour gratuit.' }],
    };

    const out = sanitizeLandingContent(content);

    expect(out.hero?.kicker).toBe('NOUVEAU');
    expect(out.hero?.headline_html).toBe('La lampe qui suit ta lecture');
    expect(out.hero?.lede).toBe('Une lumière stable pour lire tard.');
    expect(out.selling_points?.[0].body).toBe('Conçue pour tenir un mois.');
    expect(out.selling_points?.[1]).toEqual({
      title: 'Charge USB-C',
      body: 'Pleine charge en 90 minutes.',
    });
    expect(out.showcase?.lede).toBe('Édition pensée pour le soir.');
    expect(out.final_cta?.headline_html).toBe('Lis <em>mieux</em>');
    expect(out.trust_promises?.[0]).toEqual({
      title: 'Essai 30 jours',
      body: 'Retour gratuit.',
    });
    // Input is never mutated.
    expect(content.hero?.kicker).toBe('NOUVEAU · 2023');
  });

  it('cleans the luxury copy when present', () => {
    const content: LandingContent = {
      luxury_copy: {
        hero_eyebrow: 'Édition 2024 · Pièce signature',
        hero_lede: 'Depuis 2023, chaque pièce est montée à la main.',
        story_headline: 'Le geste précède l\'objet',
        story_body: [
          'Un cuir choisi pour sa patine, tanné en 2022.',
          'Chaque couture est faite au fil de lin.',
        ],
        atelier_pillars: [
          { title: 'Matière', body: 'Laiton massif, poli en 2024 à la main.' },
          { title: 'Temps', body: 'Six semaines de façonnage.' },
        ],
        price_rationale: 'Le prix rémunère le temps, pas la saison 2025.',
        packaging_headline: 'Un coffret pensé pour durer',
        packaging_body: 'Carton épais, ruban gros-grain.',
        final_cta_note: 'Façonné à la commande, livré sous six semaines.',
      },
    };

    const out = sanitizeLandingContent(content);
    const lux = out.luxury_copy!;

    expect(lux.hero_eyebrow).toBe('Édition · Pièce signature');
    expect(lux.hero_lede).toBe('Chaque pièce est montée à la main.');
    expect(lux.story_headline).toBe('Le geste précède l\'objet');
    expect(lux.story_body[0]).toBe('Un cuir choisi pour sa patine, tanné.');
    expect(lux.story_body[1]).toBe('Chaque couture est faite au fil de lin.');
    expect(lux.atelier_pillars[0].body).toBe('Laiton massif, poli à la main.');
    expect(lux.atelier_pillars[1].body).toBe('Six semaines de façonnage.');
    expect(lux.price_rationale).toBe('Le prix rémunère le temps, pas la saison.');
    expect(lux.packaging_headline).toBe('Un coffret pensé pour durer');
    expect(lux.final_cta_note).toBe('Façonné à la commande, livré sous six semaines.');
  });

  it('passes through content with no dated copy untouched', () => {
    const content: LandingContent = {
      hero: { kicker: 'Nouveau', headline_html: 'Un halo <em>précis</em>' },
      specs: [{ key: 'Poids', value: '180 g' }],
      included_items: [{ qty: '01', label: 'Lampe de lecture' }],
    };
    expect(sanitizeLandingContent(content)).toEqual(content);
  });
});
