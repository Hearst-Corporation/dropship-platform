/**
 * Coverage for the Google Ads Keyword Plan Idea Service client.
 *
 * Focus: `isKeywordPlannerConfigured()` mirrors `isGoogleAdsConfigured()`,
 * the happy path normalizes a realistic `generateKeywordIdeas` response
 * (including EUR bid conversion and coarse/missing-metrics handling), the
 * "not configured" path returns an empty array without any network call,
 * and API errors / thrown exceptions fail soft (empty array, never throws).
 *
 * No real network calls are made — `fetch` is stubbed exactly like
 * `lib/ads/google-ads.test.ts` does.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stubValidEnv(): void {
  vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', 'dev-token-xyz');
  vi.stubEnv('GOOGLE_ADS_CLIENT_ID', 'client-id-xyz');
  vi.stubEnv('GOOGLE_ADS_CLIENT_SECRET', 'client-secret-xyz');
  vi.stubEnv('GOOGLE_ADS_REFRESH_TOKEN', 'refresh-token-xyz');
  vi.stubEnv('GOOGLE_ADS_CUSTOMER_ID', '2877134493');
  vi.stubEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID', '');
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('isKeywordPlannerConfigured()', () => {
  it('returns true when all required env vars are present (same as isGoogleAdsConfigured)', async () => {
    const { isKeywordPlannerConfigured } = await import('./keyword-planner');
    stubValidEnv();
    expect(isKeywordPlannerConfigured()).toBe(true);
  });

  it('returns false when a required var is missing', async () => {
    const { isKeywordPlannerConfigured } = await import('./keyword-planner');
    stubValidEnv();
    vi.stubEnv('GOOGLE_ADS_REFRESH_TOKEN', '');
    expect(isKeywordPlannerConfigured()).toBe(false);
  });
});

describe('buildGenerateKeywordIdeasRequest', () => {
  it('builds the /v21/ generateKeywordIdeas URL with a keywordSeed body', async () => {
    stubValidEnv();
    const { buildGenerateKeywordIdeasRequest } = await import('./keyword-planner');
    const { url, body } = buildGenerateKeywordIdeasRequest({
      seedKeywords: ['diffuseur huiles essentielles', 'roller quartz visage'],
      countryCode: 'FR',
      languageCode: 'fr',
    });
    expect(url).toContain('/v21/');
    expect(url).toContain(':generateKeywordIdeas');
    expect(url).toContain('customers/2877134493');
    expect(body.keywordSeed).toEqual({
      keywords: ['diffuseur huiles essentielles', 'roller quartz visage'],
    });
    expect(body.geoTargetConstants).toEqual(['geoTargetConstants/2250']);
    expect(body.language).toBe('languageConstants/1002');
    expect(body.keywordPlanNetwork).toBe('GOOGLE_SEARCH');
  });

  it('falls back to urlSeed when no seed keywords are given', async () => {
    stubValidEnv();
    const { buildGenerateKeywordIdeasRequest } = await import('./keyword-planner');
    const { body } = buildGenerateKeywordIdeasRequest({
      seedUrl: 'https://example.com/shop/lumora',
      countryCode: 'AE',
    });
    expect(body.keywordSeed).toBeUndefined();
    expect(body.urlSeed).toEqual({ url: 'https://example.com/shop/lumora' });
    expect(body.geoTargetConstants).toEqual(['geoTargetConstants/2784']);
  });

  it('defaults an unmapped country to France geo target', async () => {
    stubValidEnv();
    const { buildGenerateKeywordIdeasRequest } = await import('./keyword-planner');
    const { body } = buildGenerateKeywordIdeasRequest({
      seedKeywords: ['test'],
      countryCode: 'ZZ',
    });
    expect(body.geoTargetConstants).toEqual(['geoTargetConstants/2250']);
  });
});

describe('parseGenerateKeywordIdeasResponse', () => {
  it('normalizes a realistic response including EUR bid conversion', async () => {
    const { parseGenerateKeywordIdeasResponse } = await import('./keyword-planner');
    const result = parseGenerateKeywordIdeasResponse({
      results: [
        {
          text: 'diffuseur huiles essentielles',
          keywordIdeaMetrics: {
            avgMonthlySearches: '9900',
            competition: 'MEDIUM',
            competitionIndex: '45',
            lowTopOfPageBidMicros: '450000',
            highTopOfPageBidMicros: '1200000',
          },
        },
      ],
    });
    expect(result).toEqual([
      {
        keyword: 'diffuseur huiles essentielles',
        avgMonthlySearches: 9900,
        competition: 'MEDIUM',
        competitionIndex: 45,
        lowTopOfPageBidMicros: 450000,
        highTopOfPageBidMicros: 1200000,
        lowTopOfPageBidEur: 0.45,
        highTopOfPageBidEur: 1.2,
      },
    ]);
  });

  it('passes through null metrics for coarse-bucket / insufficient-spend-history accounts (KNOWN LIMITATION)', async () => {
    const { parseGenerateKeywordIdeasResponse } = await import('./keyword-planner');
    const result = parseGenerateKeywordIdeasResponse({
      results: [{ text: 'roller quartz visage', keywordIdeaMetrics: {} }],
    });
    expect(result).toEqual([
      {
        keyword: 'roller quartz visage',
        avgMonthlySearches: null,
        competition: 'UNKNOWN',
        competitionIndex: null,
        lowTopOfPageBidMicros: null,
        highTopOfPageBidMicros: null,
        lowTopOfPageBidEur: null,
        highTopOfPageBidEur: null,
      },
    ]);
  });

  it('handles a totally missing keywordIdeaMetrics block without crashing', async () => {
    const { parseGenerateKeywordIdeasResponse } = await import('./keyword-planner');
    const result = parseGenerateKeywordIdeasResponse({ results: [{ text: 'bien-être maison' }] });
    expect(result[0]!.avgMonthlySearches).toBeNull();
    expect(result[0]!.competition).toBe('UNKNOWN');
  });

  it('returns an empty array for a malformed/empty response', async () => {
    const { parseGenerateKeywordIdeasResponse } = await import('./keyword-planner');
    expect(parseGenerateKeywordIdeasResponse({})).toEqual([]);
    expect(parseGenerateKeywordIdeasResponse(null)).toEqual([]);
    expect(parseGenerateKeywordIdeasResponse({ results: [] })).toEqual([]);
  });

  it('filters out results with empty/missing text', async () => {
    const { parseGenerateKeywordIdeasResponse } = await import('./keyword-planner');
    const result = parseGenerateKeywordIdeasResponse({
      results: [{ text: '' }, { text: '   ' }, {}, { text: 'valide' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.keyword).toBe('valide');
  });
});

describe('generateKeywordIdeas — not configured', () => {
  it('returns an empty array without making any network call when env vars are missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { generateKeywordIdeas } = await import('./keyword-planner');
    const result = await generateKeywordIdeas({ seedKeywords: ['test'], countryCode: 'FR' });
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty array when configured but no seed keywords/url are given', async () => {
    stubValidEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { generateKeywordIdeas } = await import('./keyword-planner');
    const result = await generateKeywordIdeas({ countryCode: 'FR' });
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('generateKeywordIdeas — happy path', () => {
  it('exchanges the refresh token then returns normalized keyword ideas', async () => {
    stubValidEnv();
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        calls.push(url);
        if (url.includes('oauth2.googleapis.com')) {
          return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
        }
        if (url.includes(':generateKeywordIdeas')) {
          expect(url).toContain('/v21/');
          const headers = init?.headers as Record<string, string>;
          expect(headers.Authorization).toBe('Bearer tok');
          expect(headers['developer-token']).toBe('dev-token-xyz');
          return new Response(
            JSON.stringify({
              results: [
                {
                  text: 'diffuseur huiles essentielles',
                  keywordIdeaMetrics: {
                    avgMonthlySearches: 9900,
                    competition: 'MEDIUM',
                    competitionIndex: 45,
                    lowTopOfPageBidMicros: 450000,
                    highTopOfPageBidMicros: 1200000,
                  },
                },
                {
                  text: 'aromathérapie maison',
                  keywordIdeaMetrics: {
                    competition: 'LOW',
                  },
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const { generateKeywordIdeas } = await import('./keyword-planner');
    const result = await generateKeywordIdeas({
      seedKeywords: ['diffuseur huiles essentielles'],
      countryCode: 'FR',
      languageCode: 'fr',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      keyword: 'diffuseur huiles essentielles',
      avgMonthlySearches: 9900,
      competition: 'MEDIUM',
      competitionIndex: 45,
      lowTopOfPageBidMicros: 450000,
      highTopOfPageBidMicros: 1200000,
      lowTopOfPageBidEur: 0.45,
      highTopOfPageBidEur: 1.2,
    });
    expect(result[1]!.competition).toBe('LOW');
    expect(result[1]!.avgMonthlySearches).toBeNull();
    expect(calls.some((u) => u.includes('oauth2.googleapis.com'))).toBe(true);
  });
});

describe('generateKeywordIdeas — fails soft on API error', () => {
  it('returns an empty array (never throws) on a non-200 response', async () => {
    stubValidEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('oauth2.googleapis.com')) {
          return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { message: 'PERMISSION_DENIED' } }), { status: 403 });
      }),
    );

    const { generateKeywordIdeas } = await import('./keyword-planner');
    const result = await generateKeywordIdeas({ seedKeywords: ['test'], countryCode: 'FR' });
    expect(result).toEqual([]);
  });

  it('returns an empty array (never throws) when the token exchange fails', async () => {
    stubValidEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('server error', { status: 500 })),
    );

    const { generateKeywordIdeas } = await import('./keyword-planner');
    const result = await generateKeywordIdeas({ seedKeywords: ['test'], countryCode: 'FR' });
    expect(result).toEqual([]);
  });

  it('returns an empty array (never throws) when fetch itself rejects', async () => {
    stubValidEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const { generateKeywordIdeas } = await import('./keyword-planner');
    const result = await generateKeywordIdeas({ seedKeywords: ['test'], countryCode: 'FR' });
    expect(result).toEqual([]);
  });
});
