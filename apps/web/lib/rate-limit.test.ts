import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: mocks.query }),
}));

describe('rate-limit — in-memory/Postgres fallback (no Upstash configured)', () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    // Each test re-imports the module fresh so the lazily-cached Redis
    // client / warned-once flag don't leak across tests/env states.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it('falls back to the Postgres-backed limiter when Upstash env vars are absent', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });
    const { checkRateLimit } = await import('./rate-limit');

    const result = await checkRateLimit('test-key', { max: 5, windowSec: 60 });

    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0]?.[0]).toContain('dropship_rate_limits');
  });

  it('reports over-limit once the Postgres bucket count exceeds max', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ count: 6 }] });
    const { checkRateLimit } = await import('./rate-limit');

    const result = await checkRateLimit('test-key', { max: 5, windowSec: 60 });

    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSec).toBeGreaterThanOrEqual(0);
  });

  it('enforceRateLimit returns a 429 Response with Retry-After when over limit (Postgres fallback)', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ count: 100 }] });
    const { enforceRateLimit } = await import('./rate-limit');

    const req = new Request('http://localhost/api/whatever', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    const res = await enforceRateLimit(req, 'test-scope', { max: 10, windowSec: 60 });

    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    expect(res?.headers.get('Retry-After')).toBeTruthy();
  });

  it('enforceRateLimit returns null (pass-through) when under limit', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });
    const { enforceRateLimit } = await import('./rate-limit');

    const req = new Request('http://localhost/api/whatever', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    const res = await enforceRateLimit(req, 'test-scope', { max: 10, windowSec: 60 });

    expect(res).toBeNull();
  });

  it('fails open: a Postgres error does not throw, enforceRateLimit still returns null', async () => {
    mocks.query.mockRejectedValueOnce(new Error('DB unreachable'));
    const { enforceRateLimit } = await import('./rate-limit');

    const req = new Request('http://localhost/api/whatever');
    const res = await enforceRateLimit(req, 'test-scope', { max: 10, windowSec: 60 });

    expect(res).toBeNull();
  });

  it('clientIp reads x-forwarded-for first, then x-real-ip, then falls back to "unknown"', async () => {
    const { clientIp } = await import('./rate-limit');

    expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9, 1.1.1.1' } }))).toBe(
      '9.9.9.9',
    );
    expect(clientIp(new Request('http://x', { headers: { 'x-real-ip': '8.8.8.8' } }))).toBe('8.8.8.8');
    expect(clientIp(new Request('http://x'))).toBe('unknown');
  });
});
