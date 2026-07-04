/**
 * Niche opportunity scorer.
 *
 * Purpose: given a batch of candidate niches (`CANDIDATE_NICHES` in
 * `candidate-niches.ts`), rank them so the `discover_opportunity` copilot
 * tool can answer "find me the best product niche to launch right now"
 * without the operator naming one first.
 *
 * This mirrors the style of `product-scorer.ts` (a pure weighted formula
 * over normalized 0-1 sub-scores, top-level `WEIGHT_*` constants summing to
 * 1.0) but scores NICHES, not individual products:
 *
 *  - CPC        : cheap average top-of-page bid (Google Keyword Planner) is
 *                 more accessible for a small/beginner ad budget.
 *  - VOLUME     : search demand (log-scale, mirrors product-scorer's ORDERS
 *                 sub-score, since search volume is heavily right-skewed).
 *  - SEASONALITY: proximity to a matching upcoming commercial event
 *                 (Noël, Saint-Valentin, rentrée...). Evergreen niches get
 *                 a flat moderate score rather than zero.
 *  - SATURATION : Meta Ads Library saturation, inverted — less ad
 *                 saturation = easier to compete = higher sub-score.
 *
 * Both dependencies (`lib/agent/candidate-niches.ts` and the
 * `getUpcomingCommercialEvents` export of `lib/agent/research/prompts.ts`)
 * are now merged — imported directly below. `CandidateNiche.seasonalTags`
 * values line up 1:1 with `CommercialEvent.id` string literals except
 * `candidate-niches` adds `'evergreen'`, which has no corresponding
 * commercial event by design (handled explicitly in `seasonalitySubScore`).
 */

import { generateKeywordIdeas, type KeywordIdea } from '@/lib/ads/keyword-planner';
import { validateNiche } from '@/lib/trends/meta-library';
import type { CandidateNiche, SeasonalTag } from './candidate-niches';
import { getUpcomingCommercialEvents, type CommercialEvent, type CommercialEventId } from './research/prompts';

export type { CandidateNiche, SeasonalTag } from './candidate-niches';
export type { CommercialEvent, CommercialEventId } from './research/prompts';

// ── Result shape ───────────────────────────────────────────────────────

export interface RankedNiche {
  niche: CandidateNiche;
  score: number;
  signals: {
    cpcScore: number;
    volumeScore: number;
    seasonalityScore: number;
    saturationScore: number;
  };
  matchedEvent?: { label: string; daysAway: number };
  justification: string;
  keywordDataAvailable: boolean;
}

export interface ScoreNicheOpportunitiesOptions {
  countryCode?: string;
  languageCode?: string;
  referenceDate?: Date;
  limit?: number;
}

// ── Tunable weights (sum = 1.0) ───────────────────────────────────────
export const WEIGHT_CPC = 0.3;
export const WEIGHT_VOLUME = 0.3;
export const WEIGHT_SEASONALITY = 0.25;
export const WEIGHT_SATURATION = 0.15;

const NEUTRAL_SCORE = 0.5;
const EVERGREEN_SCORE = 0.5;

// Keyword ideas cost real API quota against a throttled dev token — cache
// per-process for an hour so repeated scoring passes (or overlapping
// operator requests) don't re-hit Google Ads for the same seed set.
const KEYWORD_CACHE_TTL_MS = 60 * 60 * 1000;
interface KeywordCacheEntry {
  ideas: KeywordIdea[];
  fetchedAt: number;
}
const _keywordCache = new Map<string, KeywordCacheEntry>();

function keywordCacheKey(seedKeywords: string[], countryCode: string): string {
  return `${[...seedKeywords].sort().join('|')}::${countryCode.toUpperCase()}`;
}

async function cachedGenerateKeywordIdeas(
  seedKeywords: string[],
  countryCode: string,
  languageCode: string,
): Promise<KeywordIdea[]> {
  const key = keywordCacheKey(seedKeywords, countryCode);
  const cached = _keywordCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < KEYWORD_CACHE_TTL_MS) {
    return cached.ideas;
  }
  const ideas = await generateKeywordIdeas({ seedKeywords, countryCode, languageCode });
  _keywordCache.set(key, { ideas, fetchedAt: Date.now() });
  return ideas;
}

/** Clears the module-level keyword cache. Test-only helper. */
export function _clearNicheScorerCaches(): void {
  _keywordCache.clear();
}

// ── Sub-score computation ─────────────────────────────────────────────

// Mirrors product-scorer.ts's log-scale ORDERS sub-score: search volume is
// heavily right-skewed, so a raw linear normalization would let one viral
// keyword dominate. 500k avg monthly searches ⇒ volume sub-score ≈ 1.0.
const VOLUME_LOG_REF = Math.log10(500_000);

// CPC range we consider "accessible" for a beginner FB/Google Ads budget.
// Below the floor is suspicious/free traffic noise; above the ceiling is
// a genuinely expensive vertical (insurance-tier CPC).
const CPC_FLOOR_EUR = 0.05;
const CPC_CEILING_EUR = 5;

function cpcSubScoreFromIdeas(ideas: KeywordIdea[]): { score: number; avgCpcEur: number | null } {
  const bids = ideas
    .map((i) => i.lowTopOfPageBidEur)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (bids.length === 0) return { score: NEUTRAL_SCORE, avgCpcEur: null };

  const avg = bids.reduce((a, b) => a + b, 0) / bids.length;
  const clamped = Math.min(CPC_CEILING_EUR, Math.max(CPC_FLOOR_EUR, avg));
  // Inverse-normalize: cheaper CPC → higher score.
  const score = 1 - (clamped - CPC_FLOOR_EUR) / (CPC_CEILING_EUR - CPC_FLOOR_EUR);
  return { score: Math.min(1, Math.max(0, score)), avgCpcEur: Math.round(avg * 100) / 100 };
}

function volumeSubScoreFromIdeas(ideas: KeywordIdea[]): { score: number; avgVolume: number | null } {
  const volumes = ideas
    .map((i) => i.avgMonthlySearches)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (volumes.length === 0) return { score: NEUTRAL_SCORE, avgVolume: null };

  const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const score = Math.min(1, Math.log10(avg + 1) / VOLUME_LOG_REF);
  return { score, avgVolume: Math.round(avg) };
}

/** Maps a SeasonalTag to the matching CommercialEvent.id, when one exists. */
function seasonalTagToEventId(tag: SeasonalTag): CommercialEventId | null {
  if (tag === 'evergreen') return null;
  return tag as CommercialEventId;
}

function seasonalitySubScore(
  niche: CandidateNiche,
  events: CommercialEvent[],
): { score: number; matchedEvent?: { label: string; daysAway: number } } {
  const tags = niche.seasonalTags ?? [];
  if (tags.length === 0) return { score: NEUTRAL_SCORE };

  const isEvergreenOnly = tags.length === 1 && tags[0] === 'evergreen';
  if (isEvergreenOnly) return { score: EVERGREEN_SCORE };

  const eventIds = new Set(tags.map(seasonalTagToEventId).filter((id): id is CommercialEventId => id != null));
  if (eventIds.size === 0) return { score: EVERGREEN_SCORE };

  const matches = events.filter((e) => eventIds.has(e.id) && e.daysAway >= 0);
  if (matches.length === 0) return { score: EVERGREEN_SCORE };

  const closest = matches.reduce((best, cur) => (cur.daysAway < best.daysAway ? cur : best));
  const score = Math.min(1, Math.max(0, 1 - closest.daysAway / 100));
  return { score, matchedEvent: { label: closest.label, daysAway: closest.daysAway } };
}

async function saturationSubScore(niche: CandidateNiche, countryCode: string): Promise<number> {
  try {
    const country = normalizeValidatorCountry(countryCode);
    const result = await validateNiche(niche.label, { country });
    // meta-library's `saturation` is 0-100, higher = more crowded. Invert
    // and normalize to 0-1 so higher = less saturated = easier to compete.
    if (!Number.isFinite(result.saturation)) return NEUTRAL_SCORE;
    const clamped = Math.min(100, Math.max(0, result.saturation));
    return 1 - clamped / 100;
  } catch {
    return NEUTRAL_SCORE;
  }
}

/** `validateNiche` only accepts FR/BE/CH/CA — fall back to FR otherwise. */
function normalizeValidatorCountry(countryCode: string): 'FR' | 'BE' | 'CH' | 'CA' {
  const upper = countryCode.toUpperCase();
  if (upper === 'FR' || upper === 'BE' || upper === 'CH' || upper === 'CA') return upper;
  return 'FR';
}

function fmtEur(n: number): string {
  return n.toFixed(2).replace('.', ',') + '€';
}

function fmtVolume(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function buildJustification(
  niche: CandidateNiche,
  signals: RankedNiche['signals'],
  avgCpcEur: number | null,
  avgVolume: number | null,
  matchedEvent: { label: string; daysAway: number } | undefined,
): string {
  const parts: string[] = [];

  if (avgCpcEur != null && signals.cpcScore >= 0.6) {
    parts.push(`CPC bas (${fmtEur(avgCpcEur)})`);
  } else if (avgCpcEur != null && signals.cpcScore <= 0.3) {
    parts.push(`CPC élevé (${fmtEur(avgCpcEur)})`);
  }

  if (matchedEvent && signals.seasonalityScore >= 0.5) {
    parts.push(`pic saisonnier ${matchedEvent.label} dans ${matchedEvent.daysAway}j`);
  } else if (niche.seasonalTags?.length === 1 && niche.seasonalTags[0] === 'evergreen') {
    parts.push('niche evergreen, demande stable toute l\'année');
  }

  if (parts.length < 2 && avgVolume != null && signals.volumeScore >= 0.6) {
    parts.push(`volume de recherche élevé (${fmtVolume(avgVolume)}/mois)`);
  }

  if (parts.length < 2 && signals.saturationScore >= 0.7) {
    parts.push('faible saturation publicitaire, marché ouvert');
  } else if (parts.length < 2 && signals.saturationScore <= 0.3) {
    parts.push('marché déjà saturé en publicité');
  }

  if (parts.length === 0) {
    parts.push('signaux mitigés, à valider par une recherche approfondie');
  }

  const sentence = parts.slice(0, 2).join(' et ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

// ── Public entry point ─────────────────────────────────────────────────

/**
 * Score and rank candidate niches. Fail-soft per niche: if keyword or
 * saturation lookups throw for one niche, that niche still gets scored via
 * neutral fallbacks rather than crashing the whole batch.
 */
export async function scoreNicheOpportunities(
  candidates: readonly CandidateNiche[],
  options: ScoreNicheOpportunitiesOptions = {},
): Promise<RankedNiche[]> {
  const countryCode = options.countryCode ?? 'FR';
  const languageCode = options.languageCode ?? 'fr';
  const events = safeUpcomingCommercialEvents(options.referenceDate);

  const results: RankedNiche[] = [];

  // Serial, not Promise.all: basic-access Google Ads dev tokens throttle
  // hard on concurrent generateKeywordIdeas calls (per prior research).
  for (const niche of candidates) {
    results.push(await scoreOneNiche(niche, countryCode, languageCode, events));
  }

  results.sort((a, b) => b.score - a.score);
  if (options.limit != null && options.limit >= 0) {
    return results.slice(0, options.limit);
  }
  return results;
}

function safeUpcomingCommercialEvents(referenceDate?: Date): CommercialEvent[] {
  try {
    return getUpcomingCommercialEvents(referenceDate) ?? [];
  } catch {
    return [];
  }
}

async function scoreOneNiche(
  niche: CandidateNiche,
  countryCode: string,
  languageCode: string,
  events: CommercialEvent[],
): Promise<RankedNiche> {
  let cpcScore = NEUTRAL_SCORE;
  let volumeScore = NEUTRAL_SCORE;
  let avgCpcEur: number | null = null;
  let avgVolume: number | null = null;
  let keywordDataAvailable = false;

  try {
    const ideas = await cachedGenerateKeywordIdeas(niche.seedKeywords, countryCode, languageCode);
    if (ideas.length > 0) {
      keywordDataAvailable = true;
      const cpc = cpcSubScoreFromIdeas(ideas);
      const volume = volumeSubScoreFromIdeas(ideas);
      cpcScore = cpc.score;
      avgCpcEur = cpc.avgCpcEur;
      volumeScore = volume.score;
      avgVolume = volume.avgVolume;
    }
  } catch {
    // Fail-soft: keep neutral defaults, flag reduced confidence.
    keywordDataAvailable = false;
  }

  const { score: seasonalityScore, matchedEvent } = seasonalitySubScore(niche, events);

  let saturationScore = NEUTRAL_SCORE;
  try {
    saturationScore = await saturationSubScore(niche, countryCode);
  } catch {
    saturationScore = NEUTRAL_SCORE;
  }

  const totalWeight = WEIGHT_CPC + WEIGHT_VOLUME + WEIGHT_SEASONALITY + WEIGHT_SATURATION;
  const score =
    (cpcScore * WEIGHT_CPC +
      volumeScore * WEIGHT_VOLUME +
      seasonalityScore * WEIGHT_SEASONALITY +
      saturationScore * WEIGHT_SATURATION) /
    totalWeight;

  const signals = { cpcScore, volumeScore, seasonalityScore, saturationScore };

  return {
    niche,
    score: Math.min(1, Math.max(0, score)),
    signals,
    matchedEvent,
    justification: buildJustification(niche, signals, avgCpcEur, avgVolume, matchedEvent),
    keywordDataAvailable,
  };
}
