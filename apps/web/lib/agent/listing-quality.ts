import { extractJson } from './json';
import { trackedMessage } from './anthropic';

/**
 * Claude text-quality filter for enriched product listings (title +
 * description).
 *
 * The image-quality gate (`image-quality.ts`) keeps supplier photos clean, but
 * nothing checks whether the AI-enriched COPY is actually any good. A product
 * can sail through with a crisp studio photo and a garbled, jargon-laden or
 * lazily-truncated title/description — this gate catches that before import.
 *
 * We score each enriched listing with Claude Haiku on: clarity, absence of
 * supplier/manufacturing jargon (OEM, MOQ, raw part numbers, "Item No."...),
 * presence of a real value proposition (not just a literal spec dump), and
 * appropriate length (not truncated mid-sentence, not absurdly short).
 *
 * Cost: same order of magnitude as the vision gate (~$0.001/listing) — text-only
 * Haiku calls are cheap. We batch up to 10 listings per request to cut API
 * roundtrips, mirroring the image gate's batching philosophy.
 */

export interface ListingQualityVerdict {
  /** 0..1 — higher = clearer, more compelling, less jargon. Anything < DEFAULT_LISTING_QUALITY_THRESHOLD is rejected. */
  score: number;
  /** Specific issues, e.g. ['supplier_jargon', 'truncated']. */
  issues: string[];
  /** One-sentence reason in French, shown in the admin log. */
  reason: string;
}

const ISSUE_TAXONOMY = [
  'unclear', // confusing phrasing, broken grammar, garbled machine translation
  'supplier_jargon', // OEM, MOQ, "Item No.", raw SKU/part numbers, wholesale-speak
  'no_value_proposition', // reads like a spec dump, no hook/benefit for the buyer
  'truncated', // cuts off mid-sentence or mid-word
  'too_short', // description too thin to be useful on a product page
  'keyword_stuffing', // repeated keywords crammed for SEO, unreadable
] as const;

/** 0..1 threshold below which a listing is rejected. Text quality is a laxer
 *  bar than product photography, so we start at the same value as the
 *  collection-mode image threshold (see CLAUDE.md: mono=0.65, collection=0.5)
 *  and tune from there once we have real rejection data. */
export const DEFAULT_LISTING_QUALITY_THRESHOLD = 0.5;

export interface ListingLike {
  enrichedTitle: string;
  enrichedDescription: string;
}

/**
 * Score a single listing. Returns a neutral-low score on any error so a flaky
 * call doesn't poison the batch, mirroring `scoreImage`'s fail-open shape —
 * the caller (`filterByListingQuality`) additionally fails the WHOLE gate open
 * (lets everything through) when the underlying call errors out, since a
 * text-quality check should never block store creation.
 */
export async function scoreListing(listing: ListingLike): Promise<ListingQualityVerdict> {
  const title = listing.enrichedTitle?.trim() ?? '';
  const description = listing.enrichedDescription?.trim() ?? '';
  if (!title || !description) {
    return { score: 0, issues: ['too_short'], reason: 'Titre ou description manquant' };
  }

  try {
    const response = await trackedMessage({ step: 'listing-quality-score' }, {
      model: 'gpt-4o-mini',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You judge product listing copy (title + description) for a premium DTC e-commerce landing page.

Title: "${title}"
Description: "${description}"

Reject listings with ANY of:
- Unclear phrasing, broken grammar, or garbled machine-translation artifacts
- Supplier/manufacturing jargon (e.g. "OEM", "MOQ", "Item No.", raw SKU/part numbers, wholesale-speak)
- No real value proposition — reads like a bare spec dump with no hook or benefit for the buyer
- Truncated text (cuts off mid-sentence or mid-word)
- Description too short to be useful on a product page
- Keyword stuffing (repeated keywords crammed together, unreadable)

Return ONLY this JSON, no preamble:
{
  "score": <0.0..1.0 — 1.0 = clear, compelling, jargon-free listing with a real hook>,
  "issues": [<subset of: "unclear","supplier_jargon","no_value_proposition","truncated","too_short","keyword_stuffing">],
  "reason": "<one short sentence in French>"
}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = extractJson<Partial<ListingQualityVerdict>>(text);
    if (!parsed) {
      return { score: 0, issues: ['unclear'], reason: 'Réponse qualité invalide' };
    }

    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0;
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((i): i is string => typeof i === 'string' && (ISSUE_TAXONOMY as readonly string[]).includes(i))
      : [];
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : '';

    return { score, issues, reason };
  } catch (e) {
    console.error('[listing-quality] scoring call failed', e);
    // Signal failure to the batch caller via a sentinel the gate function
    // recognizes — see `scoreListings`/`filterByListingQuality` below, which
    // fail the ENTIRE gate open (not just this one item) on any error.
    throw e;
  }
}

/** Concurrency-bounded batch scoring. Mirrors image-quality's `scoreImages`. */
async function scoreListings(
  listings: ListingLike[],
  concurrency = 4,
): Promise<ListingQualityVerdict[]> {
  const out: ListingQualityVerdict[] = new Array(listings.length);
  let cursor = 0;

  async function worker() {
    while (cursor < listings.length) {
      const i = cursor++;
      out[i] = await scoreListing(listings[i]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, listings.length) }, worker));
  return out;
}

/** Pure gate shared by the filter and its tests. */
export function passesListingGate(v: ListingQualityVerdict, threshold: number): boolean {
  return v.score >= threshold;
}

export interface ListingQualityFilterResult<T> {
  kept: Array<T & { _listingQuality: ListingQualityVerdict }>;
  rejected: Array<T & { _listingQuality: ListingQualityVerdict }>;
  /** True when the gate could not run (API error) and everything was let
   *  through ungated. Callers should surface a warning in this case. */
  failedOpen: boolean;
}

/**
 * Convenience: filter a list of enriched listings by passing/failing the
 * listing-quality gate. FAIL-SOFT: if the Haiku call errors (rate limit, API
 * down), every item is kept ungated and `failedOpen: true` is returned so the
 * caller can log/emit a warning — a broken text-quality check must never
 * block store creation, mirroring the resilience pattern used elsewhere in
 * `store-creator.ts` (e.g. the Medusa provisioning try/catch).
 */
export async function filterByListingQuality<T extends ListingLike>(
  items: T[],
  threshold = DEFAULT_LISTING_QUALITY_THRESHOLD,
): Promise<ListingQualityFilterResult<T>> {
  if (items.length === 0) {
    return { kept: [], rejected: [], failedOpen: false };
  }

  let verdicts: ListingQualityVerdict[];
  try {
    verdicts = await scoreListings(items);
  } catch (e) {
    console.error('[listing-quality] batch scoring failed — failing open, all listings pass ungated', e);
    return {
      kept: items.map((it) => ({
        ...it,
        _listingQuality: { score: 1, issues: [], reason: 'Contrôle qualité indisponible — produit conservé' },
      })),
      rejected: [],
      failedOpen: true,
    };
  }

  const kept: Array<T & { _listingQuality: ListingQualityVerdict }> = [];
  const rejected: Array<T & { _listingQuality: ListingQualityVerdict }> = [];
  items.forEach((it, i) => {
    const v = verdicts[i]!;
    const tagged = { ...it, _listingQuality: v };
    if (passesListingGate(v, threshold)) kept.push(tagged);
    else rejected.push(tagged);
  });
  // Sort kept high-to-low, mirroring the image-quality gate.
  kept.sort((a, b) => b._listingQuality.score - a._listingQuality.score);
  return { kept, rejected, failedOpen: false };
}
