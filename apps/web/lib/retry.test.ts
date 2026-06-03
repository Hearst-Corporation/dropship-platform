/**
 * Tests for retry() in lib/retry.ts
 *
 * Uses baseDelayMs:0 + jitter:false to keep tests fast (no real sleep, no
 * fake timers needed). This avoids the Vitest unhandled-rejection noise that
 * fake timers produce with intermediate promise chains.
 */

import { describe, it, expect, vi } from 'vitest';
import { retry } from './retry';

// ── Happy path ─────────────────────────────────────────────────────────────

describe('retry — success cases', () => {
  it('returns the value immediately when the function succeeds on the first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retry(fn, { baseDelayMs: 0, jitter: false });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('succeeds on the second attempt after one transient network error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(42);

    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false });

    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('succeeds on the third attempt (last allowed) after two transient failures', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce('third');

    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false });

    expect(result).toBe('third');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ── Exhaustion — all attempts fail ────────────────────────────────────────

describe('retry — exhaustion', () => {
  it('throws the last error when all attempts are exhausted', async () => {
    const fn = vi.fn().mockImplementation(() => {
      throw new Error('econnreset');
    });

    await expect(
      retry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow('econnreset');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops retrying after maxAttempts=1 (no retry, just throw)', async () => {
    const fn = vi.fn().mockImplementation(() => {
      throw new Error('abort');
    });
    await expect(retry(fn, { maxAttempts: 1, baseDelayMs: 0 })).rejects.toThrow('abort');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── isRetryable predicate ─────────────────────────────────────────────────

describe('retry — isRetryable predicate', () => {
  it('does not retry when isRetryable returns false', async () => {
    const permanentErr = new Error('bad request');
    const fn = vi.fn().mockRejectedValue(permanentErr);

    await expect(
      retry(fn, { maxAttempts: 3, baseDelayMs: 0, isRetryable: () => false }),
    ).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries when isRetryable returns true (up to maxAttempts)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('custom'))
      .mockRejectedValueOnce(new Error('custom'))
      .mockResolvedValueOnce('done');

    const result = await retry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      jitter: false,
      isRetryable: () => true,
    });

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on Response with status 429 (rate-limit)', async () => {
    // DEFAULT_IS_RETRYABLE treats thrown Response objects as retryable for 429
    const rateLimitResponse = new Response(null, { status: 429 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce('rate-ok');

    const result = await retry(fn, { maxAttempts: 2, baseDelayMs: 0, jitter: false });

    expect(result).toBe('rate-ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on Response with status 400 (non-retryable)', async () => {
    const badRequest = new Response(null, { status: 400 });
    const fn = vi.fn().mockRejectedValue(badRequest);

    await expect(
      retry(fn, { maxAttempts: 3, baseDelayMs: 0 }),
    ).rejects.toBeInstanceOf(Response);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── Options defaults ──────────────────────────────────────────────────────

describe('retry — options', () => {
  it('uses default maxAttempts=3 when not specified', async () => {
    const fn = vi.fn().mockImplementation(() => {
      throw new Error('econnrefused');
    });
    await expect(retry(fn, { baseDelayMs: 0, jitter: false })).rejects.toThrow('econnrefused');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries correctly across multiple successful-eventual calls with 0-delay', async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 4) throw new Error('network');
      return 'capped';
    });

    const result = await retry(fn, {
      maxAttempts: 4,
      baseDelayMs: 0,
      jitter: false,
    });

    expect(result).toBe('capped');
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
