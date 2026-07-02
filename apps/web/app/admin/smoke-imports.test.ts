/**
 * Smoke test — critical server modules must import WITHOUT throwing at
 * module-evaluation time (P2/P3 hygiene).
 *
 * A route handler that throws while its module is being *evaluated* (bad
 * top-level env read, side-effectful import, accidental network call at load
 * time) breaks the whole route with an opaque 500 and is easy to introduce
 * during a refactor. This test dynamically imports a curated allow-list of
 * handlers we have individually confirmed are side-effect-free at load time
 * and asserts each resolves. It intentionally does NOT invoke the handlers —
 * only their top-level evaluation is under test.
 *
 * Runs under vitest with `environment: 'node'` (see vitest.config.ts). The
 * `server-only` import is aliased to a no-op in that config, and `@` resolves
 * to apps/web, so `@/lib/*` imports work here.
 *
 * Heavy / side-effectful deps are stubbed BEFORE any import below:
 *   - `@/lib/db` — getDb/getDbRead return a stub pool whose query() resolves
 *     to `{ rows: [] }`, so no real Postgres connection is attempted even if a
 *     module were to query at load time.
 *   - global `fetch` — stubbed to reject, so any accidental top-level network
 *     call surfaces as a failed import rather than a real request.
 *
 * INTENTIONALLY EXCLUDED (do not add without re-verifying):
 *   - Any route importing `next/headers` at top level — throws outside a real
 *     Next request/render scope (none of the curated routes do).
 *   - app/api/agent/super/sessions/route + app/api/agent/research/sessions/route
 *     — deep transitive graphs (super-agent → kimi/comfy/fal clients,
 *     research-copilot → tools/executors) that are out of scope for a
 *     conservative load-time smoke check.
 *   - Storefront `[slug]/page.tsx` and other `force-dynamic` pages — they pull
 *     in template + Medusa render paths not meant for bare module eval.
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Stub heavy / side-effectful deps BEFORE importing any module under test.
// ---------------------------------------------------------------------------

const stubPool = {
  query: () => Promise.resolve({ rows: [] }),
};

vi.mock('@/lib/db', () => ({
  getDb: () => stubPool,
  getDbRead: () => stubPool,
}));

// Any accidental network call at module-evaluation time should fail loudly
// as a rejected import rather than hit the wire.
vi.stubGlobal(
  'fetch',
  vi.fn(() => Promise.reject(new Error('fetch is stubbed in smoke-imports.test.ts'))),
);

// ---------------------------------------------------------------------------
// Curated allow-list — only modules READ and confirmed to import cleanly under
// node with the mocks above. Keep this conservative.
// ---------------------------------------------------------------------------

const CRITICAL_MODULES = [
  // Middleware calls this to resolve custom domains — one indexed SELECT.
  '@/app/api/domain-resolve/route',
  // Medusa reachability probe — env read + fetch (fetch is stubbed).
  '@/app/api/medusa/health/route',
  // Admin store list — getDb + verifyAdminAuth, both pure at load time.
  '@/app/api/agent/stores/route',
  // Niche validation — zod + meta-library (type-only Anthropic import) + rate-limit.
  '@/app/api/agent/niches/validate/route',
  // Order forwarding surface — medusa client + getDb, both side-effect-free at load.
  '@/app/api/agent/orders/route',
] as const;

describe('smoke: critical server modules import without throwing', () => {
  it.each(CRITICAL_MODULES)('imports %s', async (mod) => {
    await expect(import(/* @vite-ignore */ mod)).resolves.toBeDefined();
  });
});
