/**
 * Google Ads Keyword Plan Idea Service client.
 *
 * Provides REAL search-volume/competition/CPC-bid grounding for the ads
 * planner instead of letting the LLM invent keywords from thin air. Reuses
 * the exact same OAuth2 refresh-token credentials as `lib/ads/google-ads.ts`
 * (developer token + client id/secret + refresh token + customer id) — the
 * `adwords` scope already granted for campaign push also covers
 * `KeywordPlanIdeaService.GenerateKeywordIdeas`, so no new OAuth consent is
 * required.
 *
 * ASSUMPTION TO VERIFY BEFORE FIRST REAL USE: the exact REST path and JSON
 * request/response shape below are built from Google's documented REST
 * mapping convention for Google Ads API services
 * (`POST /{version}/customers/{customerId}:generateKeywordIdeas`, body keys
 * `keywordSeed.keywords` / `urlSeed.url` / `keywordAndUrlSeed`,
 * `geoTargetConstants`, `language`, `keywordPlanNetwork`) and the documented
 * `GenerateKeywordIdeaResult` response shape (`results[].text`,
 * `.keywordIdeaMetrics.{avgMonthlySearches,competition,competitionIndex,
 * lowTopOfPageBidMicros,highTopOfPageBidMicros}`). This has NOT been
 * exercised against the live API in this change — request-building and
 * response-parsing are kept in separate, independently testable functions
 * (`buildGenerateKeywordIdeasRequest` / `parseGenerateKeywordIdeasResponse`)
 * specifically so a future correction only touches one small function.
 *
 * KNOWN LIMITATION (Google-documented): accounts with insufficient spend
 * history get coarse historical-metrics buckets, or omitted metrics
 * entirely, instead of precise numbers. This client never crashes on that —
 * `avgMonthlySearches`/`competitionIndex`/bid fields are simply `null` when
 * absent so callers must treat them as optional signal, not guaranteed data.
 *
 * Fail-soft contract (matches `google-ads.ts` / `ads-planner.ts`): missing
 * env vars or a non-200 response never throw — callers get an empty array
 * back. Keyword research is a nice-to-have grounding signal, never a new
 * failure mode for the store-creation pipeline.
 */

import { env, isGoogleAdsConfigured } from './google-ads';

const API_VERSION = 'v21';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TIMEOUT_MS = 15_000;

export type KeywordCompetition = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export interface KeywordIdea {
  keyword: string;
  avgMonthlySearches: number | null;
  competition: KeywordCompetition;
  competitionIndex: number | null;
  lowTopOfPageBidMicros: number | null;
  highTopOfPageBidMicros: number | null;
  /** Derived from *Micros fields — 1 EUR = 1_000_000 micros. */
  lowTopOfPageBidEur: number | null;
  highTopOfPageBidEur: number | null;
}

export interface GenerateKeywordIdeasInput {
  /** Seed keywords/phrases to expand from. At least one of seedKeywords/seedUrl is required. */
  seedKeywords?: string[];
  /** Seed a landing page URL instead of (or in addition to) keywords. */
  seedUrl?: string;
  /** ISO 3166-1 alpha-2 country code, e.g. 'FR'. Mapped to a geoTargetConstant. */
  countryCode: string;
  /** ISO 639-1 language code, e.g. 'fr'. Defaults to 'fr'. */
  languageCode?: string;
}

/** Mirrors `isGoogleAdsConfigured()` — same credentials power both services. */
export function isKeywordPlannerConfigured(): boolean {
  return isGoogleAdsConfigured();
}

/**
 * Minimal geo-target-constant map for the markets this platform launches
 * campaigns in today. Google Ads geo target constants are stable numeric
 * IDs (documented in Google's "Geotargets" CSV) — extend this map before
 * adding a new market. Falls back to France when the country isn't mapped
 * so the request always has a geo target rather than failing.
 */
const GEO_TARGET_CONSTANTS: Record<string, string> = {
  FR: 'geoTargetConstants/2250', // France
  AE: 'geoTargetConstants/2784', // United Arab Emirates
  US: 'geoTargetConstants/2840', // United States
  GB: 'geoTargetConstants/2826', // United Kingdom
  BE: 'geoTargetConstants/2056', // Belgium
  CH: 'geoTargetConstants/2756', // Switzerland
  CA: 'geoTargetConstants/2124', // Canada
  DE: 'geoTargetConstants/2276', // Germany
  ES: 'geoTargetConstants/2724', // Spain
  IT: 'geoTargetConstants/2380', // Italy
};

/** Google Ads language constants (documented, stable numeric IDs). */
const LANGUAGE_CONSTANTS: Record<string, string> = {
  fr: 'languageConstants/1002',
  en: 'languageConstants/1000',
  ar: 'languageConstants/1019',
  es: 'languageConstants/1003',
  de: 'languageConstants/1001',
  it: 'languageConstants/1004',
};

function geoTargetFor(countryCode: string): string {
  return GEO_TARGET_CONSTANTS[countryCode.toUpperCase()] ?? GEO_TARGET_CONSTANTS.FR!;
}

function languageConstantFor(languageCode: string): string {
  return LANGUAGE_CONSTANTS[languageCode.toLowerCase()] ?? LANGUAGE_CONSTANTS.fr!;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}
let _cachedToken: CachedToken | null = null;

/**
 * OAuth2 token acquisition, duplicated (not imported) from `google-ads.ts`
 * because that module keeps its `_cachedToken` private (no export) — see
 * the doc comment on `google-ads.ts` explaining the analytics/ads split for
 * the same reasoning: two small independent caches are simpler and safer
 * than threading a shared mutable cache across modules that ship
 * independently. Same credentials, same token endpoint, same shape.
 */
async function getAccessToken(signal: AbortSignal): Promise<string> {
  const now = Date.now();
  if (_cachedToken && _cachedToken.expiresAt > now + 30_000) return _cachedToken.accessToken;

  const body = new URLSearchParams({
    client_id: env('GOOGLE_ADS_CLIENT_ID'),
    client_secret: env('GOOGLE_ADS_CLIENT_SECRET'),
    refresh_token: env('GOOGLE_ADS_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal,
  });
  if (!res.ok) throw new Error(`keyword-planner token exchange ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  _cachedToken = { accessToken: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

function customerIdOnly(): string {
  return env('GOOGLE_ADS_CUSTOMER_ID').replace(/\D/g, '');
}

function loginCustomerId(): string | null {
  const id = env('GOOGLE_ADS_LOGIN_CUSTOMER_ID').replace(/\D/g, '');
  return id || null;
}

/** Google Ads "micros" convention — 1 EUR = 1_000_000 micros. */
function microsToEur(micros: number | null | undefined): number | null {
  if (micros === null || micros === undefined) return null;
  return Math.round((micros / 1_000_000) * 100) / 100;
}

/**
 * Build the REST request URL + JSON body for `generateKeywordIdeas`.
 * Kept pure/exported so it's independently unit-testable without any HTTP
 * mocking, and so the exact shape can be corrected in one place if it turns
 * out to diverge from the live API.
 *
 * ASSUMPTION (verify against live docs before first real use): seed shape —
 * `keywordSeed: { keywords: string[] }`, `urlSeed: { url: string }`, or both
 * combined would normally require `keywordAndUrlSeed`; here we send
 * `keywordSeed` when keywords are present (Google prioritizes keyword seeds
 * for buying-intent grounding), else `urlSeed`.
 */
export function buildGenerateKeywordIdeasRequest(
  input: GenerateKeywordIdeasInput,
): { url: string; body: Record<string, unknown> } {
  const customerId = customerIdOnly();
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}:generateKeywordIdeas`;

  const body: Record<string, unknown> = {
    geoTargetConstants: [geoTargetFor(input.countryCode)],
    language: languageConstantFor(input.languageCode ?? 'fr'),
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    includeAdultKeywords: false,
  };

  const keywords = (input.seedKeywords ?? []).map((k) => k.trim()).filter(Boolean);
  if (keywords.length > 0) {
    body.keywordSeed = { keywords };
  } else if (input.seedUrl) {
    body.urlSeed = { url: input.seedUrl };
  }

  return { url, body };
}

interface RawKeywordIdeaMetrics {
  avgMonthlySearches?: string | number;
  competition?: string;
  competitionIndex?: string | number;
  lowTopOfPageBidMicros?: string | number;
  highTopOfPageBidMicros?: string | number;
}

interface RawKeywordIdeaResult {
  text?: string;
  keywordIdeaMetrics?: RawKeywordIdeaMetrics;
}

interface RawGenerateKeywordIdeasResponse {
  results?: RawKeywordIdeaResult[];
}

function toNumberOrNull(v: string | number | undefined): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function toCompetition(v: string | undefined): KeywordCompetition {
  if (v === 'LOW' || v === 'MEDIUM' || v === 'HIGH') return v;
  return 'UNKNOWN';
}

/**
 * Parse the raw `generateKeywordIdeas` JSON response into the normalized
 * shape this codebase consumes. Pure/exported for independent unit testing.
 * Never throws on missing/coarse metrics (documented Google limitation for
 * low-spend accounts) — absent fields simply become `null`.
 */
export function parseGenerateKeywordIdeasResponse(json: unknown): KeywordIdea[] {
  const raw = json as RawGenerateKeywordIdeasResponse;
  const results = Array.isArray(raw?.results) ? raw.results : [];

  return results
    .filter((r) => typeof r.text === 'string' && r.text.trim().length > 0)
    .map((r) => {
      const metrics = r.keywordIdeaMetrics ?? {};
      const lowMicros = toNumberOrNull(metrics.lowTopOfPageBidMicros);
      const highMicros = toNumberOrNull(metrics.highTopOfPageBidMicros);
      return {
        keyword: r.text!.trim(),
        avgMonthlySearches: toNumberOrNull(metrics.avgMonthlySearches),
        competition: toCompetition(metrics.competition),
        competitionIndex: toNumberOrNull(metrics.competitionIndex),
        lowTopOfPageBidMicros: lowMicros,
        highTopOfPageBidMicros: highMicros,
        lowTopOfPageBidEur: microsToEur(lowMicros),
        highTopOfPageBidEur: microsToEur(highMicros),
      } satisfies KeywordIdea;
    });
}

/**
 * Generate real keyword ideas (search volume, competition, CPC bid
 * estimates) grounded in Google's Keyword Plan data. Fail-soft: returns an
 * empty array on missing config, auth failure, or any API error — never
 * throws. Callers (e.g. `ads-planner.ts`) treat this as optional grounding
 * context for the LLM prompt, never a hard dependency.
 */
export async function generateKeywordIdeas(input: GenerateKeywordIdeasInput): Promise<KeywordIdea[]> {
  if (!isKeywordPlannerConfigured()) return [];
  if ((!input.seedKeywords || input.seedKeywords.length === 0) && !input.seedUrl) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const accessToken = await getAccessToken(controller.signal);
    const { url, body } = buildGenerateKeywordIdeasRequest(input);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': env('GOOGLE_ADS_DEVELOPER_TOKEN'),
      'Content-Type': 'application/json',
    };
    const mcc = loginCustomerId();
    if (mcc) headers['login-customer-id'] = mcc;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('[keyword-planner] generateKeywordIdeas failed', {
        status: res.status,
        snippet: text.slice(0, 400),
      });
      return [];
    }

    const json = JSON.parse(text) as unknown;
    return parseGenerateKeywordIdeasResponse(json);
  } catch (e) {
    console.error('[keyword-planner] generateKeywordIdeas error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
