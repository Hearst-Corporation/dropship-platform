/**
 * Listing-quality gate: text-bearing enriched listings (garbled copy,
 * supplier jargon, no value proposition, truncation) are rejected below the
 * threshold; a batch-level API failure fails the gate open (everything kept,
 * ungated) rather than blocking store creation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackedMessageMock = vi.fn();
vi.mock('./anthropic', () => ({
  trackedMessage: (...args: unknown[]) => trackedMessageMock(...args),
}));

import {
  passesListingGate,
  filterByListingQuality,
  DEFAULT_LISTING_QUALITY_THRESHOLD,
  type ListingQualityVerdict,
} from './listing-quality';

function verdict(score: number, issues: string[] = []): ListingQualityVerdict {
  return { score, issues, reason: 'test' };
}

function mockVerdictResponse(v: Partial<ListingQualityVerdict>) {
  return {
    content: [{ type: 'text', text: JSON.stringify(v) }],
  };
}

beforeEach(() => {
  trackedMessageMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('passesListingGate', () => {
  it('keeps a clear listing above threshold', () => {
    expect(passesListingGate(verdict(0.6), 0.5)).toBe(true);
  });

  it('rejects below threshold', () => {
    expect(passesListingGate(verdict(0.4), 0.5)).toBe(false);
  });

  it('rejects exactly at the boundary only when below, not equal', () => {
    expect(passesListingGate(verdict(0.5), 0.5)).toBe(true);
  });
});

describe('filterByListingQuality', () => {
  it('keeps a batch of good-quality listings', async () => {
    trackedMessageMock.mockImplementation(() =>
      Promise.resolve(mockVerdictResponse({ score: 0.9, issues: [], reason: 'Clair et convaincant' })),
    );

    const products = [
      { enrichedTitle: 'Tapis Yoga Pro', enrichedDescription: 'Un tapis premium antidérapant conçu pour un confort optimal pendant vos séances, avec une adhérence renforcée et un matériau écoresponsable.' },
      { enrichedTitle: 'Bloc Yoga Confort', enrichedDescription: 'Bloc en mousse dense qui soutient votre posture et facilite chaque étirement, idéal pour les débutants comme pour les pratiquants confirmés.' },
    ];

    const { kept, rejected, failedOpen } = await filterByListingQuality(products, DEFAULT_LISTING_QUALITY_THRESHOLD);

    expect(failedOpen).toBe(false);
    expect(kept).toHaveLength(2);
    expect(rejected).toHaveLength(0);
    kept.forEach((p) => expect(p._listingQuality.score).toBeGreaterThanOrEqual(DEFAULT_LISTING_QUALITY_THRESHOLD));
  });

  it('flags and drops only the one bad listing in a mixed batch', async () => {
    trackedMessageMock.mockImplementation((_meta, params) => {
      const text = (params.messages[0].content[0] as { text: string }).text as string;
      // Only the "Title: ... Description: ..." block (before the "Reject
      // listings" instructions) reflects the actual listing under test — the
      // instructions themselves always mention "OEM" and "MOQ" as example
      // jargon terms, so matching against the full prompt would misfire on
      // every call.
      const listingBlock = text.slice(text.indexOf('Title:'), text.indexOf('Reject listings'));
      const isJargon = listingBlock.includes('OEM') || listingBlock.includes('MOQ');
      if (isJargon) {
        return Promise.resolve(
          mockVerdictResponse({ score: 0.2, issues: ['supplier_jargon'], reason: 'Jargon fournisseur brut' }),
        );
      }
      return Promise.resolve(mockVerdictResponse({ score: 0.85, issues: [], reason: 'Bon listing' }));
    });

    const products = [
      { enrichedTitle: 'Tapis Yoga Pro', enrichedDescription: 'Un tapis premium antidérapant conçu pour un confort optimal pendant vos séances de yoga quotidiennes.' },
      { enrichedTitle: 'Item No. YM-2024 OEM', enrichedDescription: 'OEM MOQ 500pcs wholesale factory direct raw material spec sheet.' },
    ];

    const { kept, rejected, failedOpen } = await filterByListingQuality(products, DEFAULT_LISTING_QUALITY_THRESHOLD);

    expect(failedOpen).toBe(false);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.enrichedTitle).toBe('Tapis Yoga Pro');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.enrichedTitle).toBe('Item No. YM-2024 OEM');
    expect(rejected[0]!._listingQuality.issues).toContain('supplier_jargon');
  });

  it('fails soft on API error: all products pass through ungated, no throw', async () => {
    trackedMessageMock.mockRejectedValue(new Error('rate limited'));

    const products = [
      { enrichedTitle: 'Tapis Yoga Pro', enrichedDescription: 'Un tapis premium antidérapant conçu pour un confort optimal.' },
      { enrichedTitle: 'Bloc Yoga', enrichedDescription: 'Bloc en mousse dense pour soutenir votre posture.' },
    ];

    const result = await filterByListingQuality(products, DEFAULT_LISTING_QUALITY_THRESHOLD);

    expect(result.failedOpen).toBe(true);
    expect(result.kept).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
  });

  it('returns empty result for an empty input without calling the model', async () => {
    const result = await filterByListingQuality([], DEFAULT_LISTING_QUALITY_THRESHOLD);
    expect(result).toEqual({ kept: [], rejected: [], failedOpen: false });
    expect(trackedMessageMock).not.toHaveBeenCalled();
  });
});
