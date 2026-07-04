/**
 * Unit coverage for the niche opportunity scorer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const commercialEvents = vi.hoisted(() => ({
  events: [] as Array<{ id: string; label: string; date: string; daysAway: number }>,
}));

vi.mock('./research/prompts', () => ({
  getUpcomingCommercialEvents: vi.fn(() => commercialEvents.events),
}));

function setUpcomingCommercialEventsProvider(
  fn: () => Array<{ id: string; label: string; date: string; daysAway: number }>,
): void {
  commercialEvents.events = fn();
}

interface KeywordIdeasCallArgs {
  seedKeywords?: string[];
  seedUrl?: string;
  countryCode: string;
  languageCode?: string;
}

const keywordPlanner = vi.hoisted(() => ({
  generateKeywordIdeas: vi.fn(async (_input: KeywordIdeasCallArgs) => [] as Array<Record<string, unknown>>),
}));

vi.mock('@/lib/ads/keyword-planner', () => ({
  generateKeywordIdeas: keywordPlanner.generateKeywordIdeas,
}));

interface MetaLibraryResult {
  saturation: number;
  verdict: 'go' | 'caution' | 'no-go';
  totalAds: number;
  topAdvertisers: unknown[];
  sampleCreatives: unknown[];
  angles: unknown[];
  source: 'meta-html' | 'claude-fallback' | 'cache';
}

const metaLibrary = vi.hoisted(() => ({
  validateNiche: vi.fn(
    async (_niche: string, _opts?: Record<string, unknown>): Promise<MetaLibraryResult> => ({
      saturation: 50,
      verdict: 'caution',
      totalAds: 50,
      topAdvertisers: [],
      sampleCreatives: [],
      angles: [],
      source: 'claude-fallback',
    }),
  ),
}));

vi.mock('@/lib/trends/meta-library', () => ({
  validateNiche: metaLibrary.validateNiche,
}));

import {
  scoreNicheOpportunities,
  _clearNicheScorerCaches,
  type CandidateNiche,
  type CommercialEvent,
} from './niche-scorer';

const REFERENCE_DATE = new Date('2026-11-01T00:00:00.000Z');

const CHRISTMAS_EVENT: CommercialEvent = {
  id: 'christmas',
  label: 'Noël',
  date: '2026-12-25',
  daysAway: 42,
};

const FAR_EVENT: CommercialEvent = {
  id: 'valentines',
  label: 'Saint-Valentin',
  date: '2027-02-14',
  daysAway: 90,
};

function niche(overrides: Partial<CandidateNiche> = {}): CandidateNiche {
  return {
    id: 'test-niche',
    label: 'test niche',
    templateNiche: 'tech',
    seedKeywords: ['test keyword'],
    seasonalTags: ['evergreen'],
    baselinePriceRangeEur: [10, 30],
    ...overrides,
  };
}

beforeEach(() => {
  keywordPlanner.generateKeywordIdeas.mockReset();
  keywordPlanner.generateKeywordIdeas.mockResolvedValue([]);
  metaLibrary.validateNiche.mockReset();
  metaLibrary.validateNiche.mockResolvedValue({
    saturation: 50,
    verdict: 'caution',
    totalAds: 50,
    topAdvertisers: [],
    sampleCreatives: [],
    angles: [],
    source: 'claude-fallback',
  });
  setUpcomingCommercialEventsProvider(() => []);
  _clearNicheScorerCaches();
});

describe('scoreNicheOpportunities', () => {
  it('ranks a niche with cheap CPC + high volume + near-term matching event highest', async () => {
    setUpcomingCommercialEventsProvider(() => [CHRISTMAS_EVENT, FAR_EVENT]);

    const winner = niche({
      id: 'winner',
      label: 'winner niche',
      seedKeywords: ['winner keyword'],
      seasonalTags: ['christmas'],
    });
    const loser = niche({
      id: 'loser',
      label: 'loser niche',
      seedKeywords: ['loser keyword'],
      seasonalTags: ['evergreen'],
    });

    keywordPlanner.generateKeywordIdeas.mockImplementation(async (input: KeywordIdeasCallArgs) => {
      if (input.seedKeywords?.includes('winner keyword')) {
        return [
          {
            keyword: 'winner keyword',
            avgMonthlySearches: 200_000,
            competition: 'MEDIUM',
            competitionIndex: 50,
            lowTopOfPageBidMicros: 100_000,
            highTopOfPageBidMicros: 300_000,
            lowTopOfPageBidEur: 0.1,
            highTopOfPageBidEur: 0.3,
          },
        ];
      }
      return [
        {
          keyword: 'loser keyword',
          avgMonthlySearches: 200,
          competition: 'HIGH',
          competitionIndex: 90,
          lowTopOfPageBidMicros: 4_500_000,
          highTopOfPageBidMicros: 6_000_000,
          lowTopOfPageBidEur: 4.5,
          highTopOfPageBidEur: 6,
        },
      ];
    });

    metaLibrary.validateNiche.mockImplementation(async (label: string): Promise<MetaLibraryResult> => ({
      saturation: label === 'winner niche' ? 10 : 90,
      verdict: 'go',
      totalAds: 10,
      topAdvertisers: [],
      sampleCreatives: [],
      angles: [],
      source: 'claude-fallback',
    }));

    const ranked = await scoreNicheOpportunities([loser, winner], { referenceDate: REFERENCE_DATE });

    expect(ranked[0]!.niche.id).toBe('winner');
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
    expect(ranked[0]!.matchedEvent?.label).toBe('Noël');
    expect(ranked[0]!.keywordDataAvailable).toBe(true);
  });

  it('still scores a niche when generateKeywordIdeas returns [] (fallback, not a crash)', async () => {
    keywordPlanner.generateKeywordIdeas.mockResolvedValue([]);

    const ranked = await scoreNicheOpportunities([niche({ id: 'no-data' })], {
      referenceDate: REFERENCE_DATE,
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.keywordDataAvailable).toBe(false);
    expect(ranked[0]!.signals.cpcScore).toBe(0.5);
    expect(ranked[0]!.signals.volumeScore).toBe(0.5);
    expect(Number.isFinite(ranked[0]!.score)).toBe(true);
  });

  it('sorts results descending by score', async () => {
    keywordPlanner.generateKeywordIdeas.mockImplementation(async (input: KeywordIdeasCallArgs) => {
      const cheap = input.seedKeywords?.includes('cheap');
      return [
        {
          keyword: cheap ? 'cheap' : 'expensive',
          avgMonthlySearches: cheap ? 100_000 : 1_000,
          competition: 'MEDIUM',
          competitionIndex: 50,
          lowTopOfPageBidMicros: cheap ? 100_000 : 4_000_000,
          highTopOfPageBidMicros: cheap ? 200_000 : 5_000_000,
          lowTopOfPageBidEur: cheap ? 0.1 : 4,
          highTopOfPageBidEur: cheap ? 0.2 : 5,
        },
      ];
    });

    const a = niche({ id: 'a', seedKeywords: ['expensive'] });
    const b = niche({ id: 'b', seedKeywords: ['cheap'] });
    const c = niche({ id: 'c', seedKeywords: ['expensive'] });

    const ranked = await scoreNicheOpportunities([a, b, c], { referenceDate: REFERENCE_DATE });

    const scores = ranked.map((r) => r.score);
    const sorted = [...scores].sort((x, y) => y - x);
    expect(scores).toEqual(sorted);
  });

  it('truncates results to the requested limit', async () => {
    const candidates = [niche({ id: '1' }), niche({ id: '2' }), niche({ id: '3' }), niche({ id: '4' })];

    const ranked = await scoreNicheOpportunities(candidates, { limit: 2, referenceDate: REFERENCE_DATE });

    expect(ranked).toHaveLength(2);
  });

  it('gives an evergreen-only niche a moderate (not zero) seasonalityScore', async () => {
    setUpcomingCommercialEventsProvider(() => [CHRISTMAS_EVENT]);

    const evergreen = niche({ id: 'evergreen-niche', seasonalTags: ['evergreen'] });
    const ranked = await scoreNicheOpportunities([evergreen], { referenceDate: REFERENCE_DATE });

    expect(ranked[0]!.signals.seasonalityScore).toBe(0.5);
    expect(ranked[0]!.signals.seasonalityScore).toBeGreaterThan(0);
  });

  it('is fail-soft when generateKeywordIdeas throws for one niche in a batch', async () => {
    keywordPlanner.generateKeywordIdeas.mockImplementation(async (input: KeywordIdeasCallArgs) => {
      if (input.seedKeywords?.includes('throws')) {
        throw new Error('rate limited');
      }
      return [];
    });

    const ok = niche({ id: 'ok', seedKeywords: ['fine'] });
    const broken = niche({ id: 'broken', seedKeywords: ['throws'] });

    const ranked = await scoreNicheOpportunities([ok, broken], { referenceDate: REFERENCE_DATE });

    expect(ranked).toHaveLength(2);
    const brokenResult = ranked.find((r) => r.niche.id === 'broken');
    expect(brokenResult?.keywordDataAvailable).toBe(false);
  });

  it('is fail-soft when the meta-library saturation check throws', async () => {
    metaLibrary.validateNiche.mockRejectedValue(new Error('scrape failed'));

    const ranked = await scoreNicheOpportunities([niche({ id: 'x' })], { referenceDate: REFERENCE_DATE });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.signals.saturationScore).toBe(0.5);
  });
});
