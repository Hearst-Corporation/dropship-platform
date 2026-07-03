/**
 * Coverage for the Google Ads campaign push helper.
 *
 * Focus of this suite: the defensive credential trimming (`env()`), the
 * `isGoogleAdsConfigured()` gate, and the API version pinned in the mutate
 * URL. No real network calls are made — `fetch` is stubbed and
 * `pushGoogleAdsCampaign` is never run against the live API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const inserted: CapturedQuery[] = [];

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  if (/^\s*INSERT\b/i.test(sql)) {
    inserted.push({ sql, params: params ?? [] });
    if (/RETURNING\s+id/i.test(sql)) {
      return Promise.resolve({
        rows: [{ id: `cmp-${inserted.length}` } as unknown as T],
        rowCount: 1,
      });
    }
  }
  return Promise.resolve({ rows: [] as T[], rowCount: 0 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

const REQUIRED = [
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_CUSTOMER_ID',
] as const;

function stubValidEnv(): void {
  vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', 'dev-token-xyz');
  vi.stubEnv('GOOGLE_ADS_CLIENT_ID', 'client-id-xyz');
  vi.stubEnv('GOOGLE_ADS_CLIENT_SECRET', 'client-secret-xyz');
  vi.stubEnv('GOOGLE_ADS_REFRESH_TOKEN', 'refresh-token-xyz');
  vi.stubEnv('GOOGLE_ADS_CUSTOMER_ID', '2877134493');
  vi.stubEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID', '');
}

beforeEach(() => {
  inserted.length = 0;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('env()', () => {
  it('trims a credential carrying newlines and surrounding whitespace', async () => {
    const { env } = await import('./google-ads');
    vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', '  dev-token-xyz\n');
    expect(env('GOOGLE_ADS_DEVELOPER_TOKEN')).toBe('dev-token-xyz');
  });

  it('returns an empty string for an undefined var (never undefined)', async () => {
    const { env } = await import('./google-ads');
    vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', '');
    expect(env('GOOGLE_ADS_DEVELOPER_TOKEN')).toBe('');
  });

  it('collapses a whitespace-only var to empty string', async () => {
    const { env } = await import('./google-ads');
    vi.stubEnv('GOOGLE_ADS_CLIENT_ID', '   \n\t ');
    expect(env('GOOGLE_ADS_CLIENT_ID')).toBe('');
  });
});

describe('isGoogleAdsConfigured()', () => {
  it('returns true when all required env vars are present (and trimmed)', async () => {
    const { isGoogleAdsConfigured } = await import('./google-ads');
    stubValidEnv();
    // A trailing newline on one var must not defeat the gate.
    vi.stubEnv('GOOGLE_ADS_CUSTOMER_ID', '2877134493\n');
    expect(isGoogleAdsConfigured()).toBe(true);
  });

  it('returns false when a required var is missing', async () => {
    const { isGoogleAdsConfigured } = await import('./google-ads');
    for (const missing of REQUIRED) {
      stubValidEnv();
      vi.stubEnv(missing, '');
      expect(isGoogleAdsConfigured(), `missing ${missing}`).toBe(false);
    }
  });

  it('returns false when a required var is only whitespace/newlines', async () => {
    const { isGoogleAdsConfigured } = await import('./google-ads');
    stubValidEnv();
    vi.stubEnv('GOOGLE_ADS_REFRESH_TOKEN', '   \n ');
    expect(isGoogleAdsConfigured()).toBe(false);
  });
});

describe('pushGoogleAdsCampaign — mutate URL version', () => {
  const args = {
    storeId: 's1',
    storeSlug: 'maison-chic',
    variantId: 'v1abcdef01234567',
    headline: 'Titre',
    primaryText: 'Texte principal',
    description: 'Desc',
    cta: 'Voir',
    imageUrl: null,
    productUrl: 'https://x.example.com/shop/maison-chic/products/p1',
    dailyBudgetEur: 25,
    days: 7,
  };

  it('targets the /v21/ mutate endpoint on every Google Ads call', async () => {
    stubValidEnv();
    const urls: string[] = [];
    let call = 0;
    // Each mutate returns a fresh resourceName so the pipeline advances.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('oauth2.googleapis.com')) {
          return new Response(
            JSON.stringify({ access_token: 'tok', expires_in: 3600 }),
            { status: 200 },
          );
        }
        urls.push(url);
        call += 1;
        return new Response(
          JSON.stringify({ results: [{ resourceName: `res/${call}` }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    const { pushGoogleAdsCampaign } = await import('./google-ads');
    const result = await pushGoogleAdsCampaign(args);

    expect(result.status).toBe('paused');
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toContain('/v21/');
      expect(url).not.toContain('/v18/');
    }
    // Sanity: the mutate resources are hit in the documented order.
    expect(urls[0]).toContain('campaignBudgets:mutate');
  });
});
