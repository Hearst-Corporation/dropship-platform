/**
 * Unit coverage for the in-handler admin auth assertion used by
 * highest-privilege routes (e.g. /api/agent/super) as defense-in-depth on
 * top of the edge middleware's Basic auth gate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function basicAuthHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`;
}

beforeEach(() => {
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'super-secret';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('requireAdmin', () => {
  it('returns a 401 Response with a WWW-Authenticate challenge when no Authorization header is present', async () => {
    const { requireAdmin } = await import('./auth');
    const res = requireAdmin(new Request('http://x'));

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    expect(res!.headers.get('WWW-Authenticate')).toMatch(/^Basic /);
  });

  it('returns null (pass-through) when the Authorization header has valid credentials', async () => {
    const { requireAdmin } = await import('./auth');
    const res = requireAdmin(
      new Request('http://x', {
        headers: { authorization: basicAuthHeader('admin', 'super-secret') },
      }),
    );

    expect(res).toBeNull();
  });

  it('returns a 401 Response when the Authorization header has wrong credentials', async () => {
    const { requireAdmin } = await import('./auth');
    const res = requireAdmin(
      new Request('http://x', {
        headers: { authorization: basicAuthHeader('admin', 'wrong-password') },
      }),
    );

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('fails closed when ADMIN_USERNAME/ADMIN_PASSWORD are not configured', async () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    const { requireAdmin } = await import('./auth');
    const res = requireAdmin(
      new Request('http://x', {
        headers: { authorization: basicAuthHeader('admin', 'super-secret') },
      }),
    );

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('rejects a malformed Authorization header (not Basic scheme)', async () => {
    const { requireAdmin } = await import('./auth');
    const res = requireAdmin(
      new Request('http://x', { headers: { authorization: 'Bearer sometoken' } }),
    );

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('bypasses auth on local dev (NODE_ENV=development, not on Vercel prod) even with no Authorization header', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.VERCEL_ENV;
    const { requireAdmin } = await import('./auth');
    const res = requireAdmin(new Request('http://x'));

    expect(res).toBeNull();
    vi.unstubAllEnvs();
  });

  it('does NOT bypass auth when NODE_ENV=development but VERCEL_ENV=production (real prod deploy)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    process.env.VERCEL_ENV = 'production';
    const { requireAdmin } = await import('./auth');
    const res = requireAdmin(new Request('http://x'));

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    vi.unstubAllEnvs();
  });
});
