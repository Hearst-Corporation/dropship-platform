/**
 * Smoke test — the three Recharts wrappers (AdminTrendChart, AdminBarChart,
 * AdminFunnelChart) must import cleanly under vitest's node environment AND
 * their empty-data branch must not throw.
 *
 * The harness is node-only (no jsdom / testing-library), so we do NOT do a full
 * Recharts render — ResponsiveContainer needs a real layout box. Instead we:
 *   1. assert each module imports without throwing (default export is a fn),
 *   2. call each component function directly with empty data. On empty input
 *      every wrapper short-circuits to its <EmptyState> branch, which is a
 *      plain React.createElement('div', …) — it returns a React element object
 *      without ever mounting Recharts, so this is safe in node.
 *
 * We mock 'recharts' to inert stubs so that even if a wrapper were to touch the
 * chart primitives at call time, no real chart code (which reaches for the DOM)
 * runs. The empty-data path never renders them anyway; the mock is belt-and-
 * braces so the test can never flake on a Recharts internals change.
 */

import { describe, it, expect, vi } from 'vitest';

// Inert Recharts stubs — every named export used by the wrappers becomes a
// no-op component. Never exercised on the empty-data path, but keeps the
// import graph free of DOM-reaching chart internals.
vi.mock('recharts', () => {
  const Stub = () => null;
  // Guard `then`: returning a function for `then` makes the module namespace
  // look thenable, which makes `await import()` hang. Everything else -> Stub.
  return new Proxy(
    { __esModule: true },
    {
      get: (_target, prop) => (prop === 'then' ? undefined : Stub),
    },
  );
});

function isReactElement(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    // React elements carry a $$typeof symbol; checking `type`/`props` presence
    // is enough for our purposes and avoids importing react just for this.
    'type' in (value as Record<string, unknown>) &&
    'props' in (value as Record<string, unknown>)
  );
}

describe('admin chart wrappers: import + empty-data smoke', () => {
  it('AdminTrendChart imports and renders empty data without throwing', async () => {
    const mod = await import('@/components/admin/AdminTrendChart');
    const AdminTrendChart = mod.default;
    expect(typeof AdminTrendChart).toBe('function');
    expect(() => {
      const el = AdminTrendChart({ data: [], xKey: 'label', series: [] });
      expect(isReactElement(el)).toBe(true);
    }).not.toThrow();
    // Also non-empty x-config but no series still hits the empty branch.
    expect(() =>
      AdminTrendChart({ data: [], xKey: 'label', series: [{ key: 'ca', label: 'CA' }] }),
    ).not.toThrow();
  });

  it('AdminBarChart imports and renders empty data without throwing', async () => {
    const mod = await import('@/components/admin/AdminBarChart');
    const AdminBarChart = mod.default;
    expect(typeof AdminBarChart).toBe('function');
    expect(() => {
      const el = AdminBarChart({ data: [], xKey: 'label', bars: [] });
      expect(isReactElement(el)).toBe(true);
    }).not.toThrow();
    expect(() =>
      AdminBarChart({ data: [], xKey: 'label', bars: [{ key: 'v', label: 'V' }] }),
    ).not.toThrow();
  });

  it('AdminFunnelChart imports and renders empty steps without throwing', async () => {
    const mod = await import('@/components/admin/AdminFunnelChart');
    const AdminFunnelChart = mod.default;
    expect(typeof AdminFunnelChart).toBe('function');
    expect(() => {
      const el = AdminFunnelChart({ steps: [] });
      expect(isReactElement(el)).toBe(true);
    }).not.toThrow();
    // Custom height on empty data must also be fine.
    expect(() => AdminFunnelChart({ steps: [], height: 320 })).not.toThrow();
  });
});
