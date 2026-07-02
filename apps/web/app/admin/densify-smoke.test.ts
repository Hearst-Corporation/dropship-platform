/**
 * Smoke test — the four admin pages restructured during the "densify" pass must
 * import WITHOUT throwing at module-evaluation time:
 *
 *   - app/admin/(app)/page.tsx           (portfolio dashboard)
 *   - app/admin/(app)/catalog/page.tsx   (Medusa catalog)
 *   - app/admin/(app)/settings/page.tsx  (platform + suppliers settings)
 *   - app/admin/(app)/stores/page.tsx    (stores list)
 *
 * A page whose module throws while it is being *evaluated* (bad top-level env
 * read, a client-child dragging DOM-only code into the load graph, an import
 * that reaches the network) breaks the route with an opaque 500 and is trivial
 * to introduce while shuffling presentation. This test dynamically imports each
 * page and asserts it resolves. It does NOT invoke the default export (the page
 * function) — only top-level evaluation is under test, mirroring the sibling
 * app/admin/smoke-imports.test.ts (which is owned elsewhere and left untouched).
 *
 * Runs under vitest `environment: 'node'`; `@` resolves to apps/web and
 * `server-only` is aliased to a no-op (see vitest.config.ts). Heavy /
 * side-effectful leaves are stubbed BEFORE any import below so no real
 * Postgres, Medusa, network, DOM-charting, or next/image optimizer is touched:
 *   - `@/lib/db`                    getDb/getDbRead -> stub pool, query -> {rows:[]}
 *   - `@/lib/medusa`                medusa.getProducts/getOrders -> [] shapes
 *   - `@/lib/suppliers/policy-view` getSupplierPolicyView -> []
 *   - `recharts`                    inert stubs (client chart children)
 *   - `next/image`                  inert stub (StoresTable uses <Image>)
 *   - global `fetch`                rejects, so any load-time request fails loud
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Stub heavy / side-effectful deps BEFORE importing any page under test.
// ---------------------------------------------------------------------------

const stubPool = {
  query: () => Promise.resolve({ rows: [] }),
};

vi.mock('@/lib/db', () => ({
  getDb: () => stubPool,
  getDbRead: () => stubPool,
}));

// The catalog page uses the `medusa` singleton (medusa.getProducts()); the
// dashboard/orders surfaces use getOrders. Return production-shaped empties so
// the page's data-mapping runs against a well-formed but empty result.
vi.mock('@/lib/medusa', () => ({
  medusa: {
    getProducts: () => Promise.resolve({ products: [], count: 0 }),
    getOrders: () => Promise.resolve({ orders: [], count: 0 }),
  },
  getMedusaBaseUrl: () => 'http://medusa.test',
  getMedusaAuthMode: () => 'missing',
}));

// Suppliers settings view — return an empty policy list so no DB table is read.
vi.mock('@/lib/suppliers/policy-view', () => ({
  getSupplierPolicyView: () => Promise.resolve([]),
}));

// Client chart children (DashboardCharts) import Recharts; stub it inert so no
// DOM-reaching chart internals enter the load graph under node.
vi.mock('recharts', () => {
  const Stub = () => null;
  // Guard `then` so the mocked module namespace is not thenable (else
  // `await import()` of a chart-importing page hangs to a timeout).
  return new Proxy(
    { __esModule: true },
    { get: (_target, prop) => (prop === 'then' ? undefined : Stub) },
  );
});

// StoresTable renders next/image; stub to an inert component.
vi.mock('next/image', () => ({
  __esModule: true,
  default: () => null,
}));

// Any accidental network call at module-evaluation time should fail loudly as
// a rejected import rather than hit the wire.
vi.stubGlobal(
  'fetch',
  vi.fn(() =>
    Promise.reject(new Error('fetch is stubbed in densify-smoke.test.ts')),
  ),
);

// ---------------------------------------------------------------------------
// The four densified page modules. Imported via the `@` alias; the `(app)`
// route-group segment is a literal directory name.
// ---------------------------------------------------------------------------

const DENSIFIED_PAGES = [
  '@/app/admin/(app)/page',
  '@/app/admin/(app)/catalog/page',
  '@/app/admin/(app)/settings/page',
  '@/app/admin/(app)/stores/page',
] as const;

describe('smoke: densified admin pages import without throwing', () => {
  it.each(DENSIFIED_PAGES)('imports %s', async (mod) => {
    const imported = await import(/* @vite-ignore */ mod);
    expect(imported).toBeDefined();
    // Each page's default export is the (async) server component function.
    expect(typeof imported.default).toBe('function');
  });
});
