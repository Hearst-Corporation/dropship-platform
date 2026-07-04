import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_NICHES,
  getNichesBySeasonalTag,
  getNichesByTemplateNiche,
  type SeasonalTag,
} from '@/lib/agent/candidate-niches';
import type { TemplateNiche } from '@/lib/template-catalog';

const VALID_TEMPLATE_NICHES: readonly TemplateNiche[] = [
  'automotive',
  'fashion',
  'beauty',
  'wellness',
  'health',
  'home',
  'pet',
  'tech',
  'food',
  'beverage',
  'jewelry',
  'travel',
  'events',
  'sport',
  'editorial',
  'gifting',
  'kids',
];

const VALID_SEASONAL_TAGS: readonly SeasonalTag[] = [
  'christmas',
  'summer',
  'back-to-school',
  'valentines',
  'mothers-day',
  'new-year',
  'black-friday',
  'evergreen',
];

describe('CANDIDATE_NICHES', () => {
  it('has at least 35 entries', () => {
    expect(CANDIDATE_NICHES.length).toBeGreaterThanOrEqual(35);
  });

  it('every entry has a valid templateNiche value', () => {
    for (const niche of CANDIDATE_NICHES) {
      expect(VALID_TEMPLATE_NICHES).toContain(niche.templateNiche);
    }
  });

  it('every entry has at least 2 seedKeywords', () => {
    for (const niche of CANDIDATE_NICHES) {
      expect(niche.seedKeywords.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('every entry has at least 1 seasonalTag, all valid', () => {
    for (const niche of CANDIDATE_NICHES) {
      expect(niche.seasonalTags.length).toBeGreaterThanOrEqual(1);
      for (const tag of niche.seasonalTags) {
        expect(VALID_SEASONAL_TAGS).toContain(tag);
      }
    }
  });

  it('has no duplicate ids', () => {
    const ids = CANDIDATE_NICHES.map((niche) => niche.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a valid baselinePriceRangeEur tuple', () => {
    for (const niche of CANDIDATE_NICHES) {
      const [min, max] = niche.baselinePriceRangeEur;
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThanOrEqual(min);
    }
  });
});

describe('getNichesBySeasonalTag', () => {
  it('returns non-empty results for at least one tag', () => {
    const results = getNichesBySeasonalTag('christmas');
    expect(results.length).toBeGreaterThan(0);
    for (const niche of results) {
      expect(niche.seasonalTags).toContain('christmas');
    }
  });
});

describe('getNichesByTemplateNiche', () => {
  it('returns non-empty results for at least one niche', () => {
    const results = getNichesByTemplateNiche('tech');
    expect(results.length).toBeGreaterThan(0);
    for (const niche of results) {
      expect(niche.templateNiche).toBe('tech');
    }
  });

  it('covers every TemplateNiche value with at least one candidate', () => {
    for (const templateNiche of VALID_TEMPLATE_NICHES) {
      expect(getNichesByTemplateNiche(templateNiche).length).toBeGreaterThan(0);
    }
  });
});
