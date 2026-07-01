/**
 * E2E harness for the agent's `createStore` pipeline (P0.2).
 *
 * Goal: exercise the full 8-step orchestration with every external dependency
 * (AliExpress, CJ, Anthropic, Medusa, Postgres) intercepted, so we can refactor
 * `store-creator.ts` without breaking the revenue-generating happy path.
 *
 * The DB layer is mocked at the module boundary via `vi.mock('@/lib/db')`.
 * HTTP traffic is intercepted by MSW (`test/setup-msw.ts`). No real network,
 * no real database — only the agent's own logic is under test.
 *
 * Two scenarios:
 *   1. **Golden path** — AE returns 4 products, Claude enriches 3, Medusa
 *      persists everything → store ends `active` with productCount=3.
 *   2. **Fallback** — AE returns 0, CJ unauthorized → `generateProductsWithClaude`
 *      path runs → store ends `active` with 3 AI-generated products.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/setup-msw';
import { emptyAliexpress } from '@/test/handlers/aliexpress';
import { resetMedusaCounter } from '@/test/handlers/medusa';
import type { AgentEvent } from './store-creator';

/**
 * In-memory DB capture. Each test gets a fresh map of executed queries plus a
 * canned response strategy: SELECT on `platform_settings` returns the
 * AliExpress access token rows; INSERT on `dropship_stores` returns a fake
 * uuid; everything else returns an empty result. Captures full (sql, params)
 * pairs so we can assert against them.
 */
interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const captured: CapturedQuery[] = [];

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  captured.push({ sql, params: params ?? [] });

  // AliExpress access-token lookup. Returns a non-expiring token row so the
  // suppliers/aliexpress.ts client treats us as authorized.
  if (sql.includes('FROM platform_settings')) {
    return Promise.resolve({
      rows: [
        {
          key: 'aliexpress_access_token',
          value: 'test-ae-access-token',
          value_enc: null,
          value_nonce: null,
          updated_at: new Date(),
        },
        {
          key: 'aliexpress_token_expires',
          // '0' means "no expiry check" inside aliexpress.ts (special case).
          value: '0',
          value_enc: null,
          value_nonce: null,
          updated_at: new Date(),
        },
      ] as unknown as T[],
      rowCount: 2,
    });
  }

  // Initial store INSERT — agent reads `rows[0].id` to get the new store id.
  if (sql.startsWith('INSERT INTO dropship_stores')) {
    return Promise.resolve({
      rows: [{ id: 'store-uuid-e2e-test-001' } as unknown as T],
      rowCount: 1,
    });
  }

  // Everything else (product inserts, status updates, error updates) — agent
  // doesn't read the rows, only checks rowCount or relies on resolution.
  return Promise.resolve({ rows: [], rowCount: 1 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    query: dbQuery,
  }),
  // Feed-only suppliers (syncee, wholesale2b, inventory-source) call getDbRead()
  // in their searchProducts. Return empty rows so they short-circuit cleanly.
  getDbRead: () => ({
    query: () => Promise.resolve({ rows: [], rowCount: 0 }),
  }),
}));

/**
 * Mutable Kimi harness. `responder` decides what each `trackedKimiMessage` call
 * returns; the default reproduces the production-shaped happy path. Tests swap
 * `kimi.responder` to drive failure modes (truncation, invalid JSON) without
 * re-mocking the module. `calls` captures (meta, messages, opts) so we can
 * assert the call site requests the right token budget. `vi.hoisted` lets the
 * `vi.mock` factory (hoisted above imports) reference it safely.
 */
const kimi = vi.hoisted(() => {
  const branding = {
    tagline: 'Test Tagline',
    description: 'Test store description',
    primaryColor: '#1F3D2C',
    secondaryColor: '#EAF2EC',
    accentColor: '#2E7D5C',
    logoEmoji: '🧘',
  };
  const usage = { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 };
  type KimiResult = { text: string; usage: typeof usage; finishReason: string | null };
  type Responder = (
    meta: { step: string },
    messages?: unknown,
    opts?: { maxTokens?: number },
  ) => KimiResult;

  const defaultResponder: Responder = ({ step }) => {
    if (step === 'generate-products') {
      return {
        text: JSON.stringify({
          products: [
            { id: 'ai-001', originalTitle: 'Yoga Mat Pro', enrichedTitle: 'Tapis Yoga Pro', enrichedDescription: 'Tapis premium antidérapant.', costCents: 800, retailPriceCents: 2199, imageUrl: '', supplierUrl: '' },
            { id: 'ai-002', originalTitle: 'Yoga Block', enrichedTitle: 'Bloc Yoga', enrichedDescription: 'Bloc en mousse dense.', costCents: 500, retailPriceCents: 1499, imageUrl: '', supplierUrl: '' },
            { id: 'ai-003', originalTitle: 'Yoga Strap', enrichedTitle: 'Sangle Yoga', enrichedDescription: 'Sangle de stretching.', costCents: 300, retailPriceCents: 999, imageUrl: '', supplierUrl: '' },
          ],
          branding,
        }),
        usage,
        finishReason: 'stop',
      };
    }
    if (step === 'enrich-products') {
      return {
        text: JSON.stringify({
          branding,
          products: [
            { index: 0, enrichedTitle: 'Tapis Yoga Pro', enrichedDescription: 'Tapis premium antidérapant.', retailPriceCents: 2199, costCents: 800 },
            { index: 1, enrichedTitle: 'Bloc Yoga', enrichedDescription: 'Bloc en mousse dense.', retailPriceCents: 1499, costCents: 500 },
            { index: 2, enrichedTitle: 'Sangle Yoga', enrichedDescription: 'Sangle de stretching.', retailPriceCents: 999, costCents: 300 },
          ],
        }),
        usage,
        finishReason: 'stop',
      };
    }
    return { text: '', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, finishReason: 'stop' };
  };

  return {
    branding,
    usage,
    defaultResponder,
    responder: defaultResponder,
    calls: [] as Array<{ meta: { step: string }; opts?: { maxTokens?: number } }>,
    reset() {
      this.responder = defaultResponder;
      this.calls = [];
    },
  };
});

vi.mock('@/lib/agent/openai-agent', () => ({
  trackedOpenAIMessage: vi.fn(
    (meta: { step: string }, messages?: unknown, opts?: { maxTokens?: number }) => {
      kimi.calls.push({ meta, opts });
      return Promise.resolve(kimi.responder(meta, messages, opts));
    },
  ),
}));

/** Drain an AsyncGenerator into an array. */
async function collectEvents(
  gen: AsyncGenerator<AgentEvent>,
): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

beforeEach(() => {
  captured.length = 0;
  resetMedusaCounter();
  kimi.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createStore — E2E pipeline', () => {
  it('golden path: enriches AE products and provisions a Medusa-backed store', async () => {
    // We import lazily so the vi.mock above is in place before module load.
    const { createStore } = await import('./store-creator');

    const events = await collectEvents(
      createStore({
        niche: 'yoga équipement',
        storeName: 'Zen Atelier',
        maxProducts: 3,
        mode: 'collection',
        language: 'fr',
      }),
    );

    // No error events — pipeline completed cleanly.
    const errors = events.filter((e) => e.type === 'error');
    expect(errors).toEqual([]);

    // Success event carries the final store payload.
    const success = events.find((e) => e.type === 'success');
    expect(success).toBeDefined();
    expect(success!.data).toMatchObject({
      storeId: 'store-uuid-e2e-test-001',
      productCount: 3,
      mode: 'collection',
    });
    expect(success!.data!.slug as string).toMatch(/^zen-atelier-/);
    expect((success!.data!.url as string)).toMatch(/^\/shop\/zen-atelier-/);

    // The agent always terminates on a 'done' event.
    expect(events[events.length - 1]!.type).toBe('done');

    // DB assertions: the orchestrator should have INSERT'd the store row and
    // flipped it to 'active' once products imported successfully.
    const inserts = captured.filter((q) =>
      q.sql.startsWith('INSERT INTO dropship_stores'),
    );
    const activations = captured.filter(
      (q) =>
        q.sql.includes('UPDATE dropship_stores') &&
        q.sql.includes("status = 'active'"),
    );
    const productInserts = captured.filter((q) =>
      q.sql.startsWith('INSERT INTO dropship_store_products'),
    );

    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.params[1]).toBe('Zen Atelier'); // storeName
    expect(inserts[0]!.params[2]).toBe('yoga équipement'); // niche
    expect(inserts[0]!.params[3]).toBe('collection'); // mode

    expect(activations).toHaveLength(1);
    // product_count is the 9th positional param of the UPDATE.
    expect(activations[0]!.params[8]).toBe(3);

    // One INSERT per imported product (all enriched from AE), supplier =
    // 'aliexpress' across the board.
    expect(productInserts).toHaveLength(3);
    for (const row of productInserts) {
      expect(row.params[2]).toBe('aliexpress');
    }
  });

  it('fallback: switches to Claude-only generation when supplier search yields nothing', async () => {
    // Force AE empty for this test only (CJ stays unauthorized by default).
    server.use(emptyAliexpress());

    const { createStore } = await import('./store-creator');

    const events = await collectEvents(
      createStore({
        niche: 'objet improbable',
        storeName: 'Objet Curieux',
        maxProducts: 3,
        mode: 'collection',
        language: 'fr',
      }),
    );

    const errors = events.filter((e) => e.type === 'error');
    expect(errors).toEqual([]);

    const success = events.find((e) => e.type === 'success');
    expect(success).toBeDefined();
    expect(success!.data).toMatchObject({
      productCount: 3,
      mode: 'collection',
    });

    // The agent emits a French progress notice when entering AI-only mode.
    const progressMsgs = events
      .filter((e) => e.type === 'progress' || e.type === 'step')
      .map((e) => e.message);
    expect(
      progressMsgs.some((m) => m.includes('génération IA')),
    ).toBe(true);

    // Product inserts should all carry supplier = 'ai-generated'.
    const productInserts = captured.filter((q) =>
      q.sql.startsWith('INSERT INTO dropship_store_products'),
    );
    expect(productInserts).toHaveLength(3);
    for (const row of productInserts) {
      expect(row.params[2]).toBe('ai-generated');
    }

    // And the store should still be activated.
    const activations = captured.filter(
      (q) =>
        q.sql.includes('UPDATE dropship_stores') &&
        q.sql.includes("status = 'active'"),
    );
    expect(activations).toHaveLength(1);
    expect(activations[0]!.params[8]).toBe(3); // product_count
  });
});

/**
 * Regression coverage for the prod incident where Kimi truncated the
 * enrichment JSON at the (old) 4096-token ceiling and the pipeline died with
 * "Claude returned invalid JSON" (store "Roadly", 2026-06-03).
 *
 * These drive the *real* extractJson + error handling in store-creator.ts via
 * the mutable `kimi.responder`, so they exercise the salvage + truncation-aware
 * error paths the happy-path tests above never hit.
 */
describe('createStore — JSON resilience (Roadly regression)', () => {
  it('recovers a truncated enrichment payload (salvage keeps complete products)', async () => {
    // Branding emitted first (survives truncation), 2 complete products, the
    // 3rd cut mid-string — exactly the max_tokens failure shape.
    kimi.responder = ({ step }) => {
      if (step === 'enrich-products') {
        const truncated =
          '{\n' +
          `  "branding": ${JSON.stringify(kimi.branding)},\n` +
          '  "products": [\n' +
          '    {"index":0,"enrichedTitle":"Tapis Yoga Pro","enrichedDescription":"desc a","retailPriceCents":2199,"costCents":800},\n' +
          '    {"index":1,"enrichedTitle":"Bloc Yoga","enrichedDescription":"desc b","retailPriceCents":1499,"costCents":500},\n' +
          '    {"index":2,"enrichedTitle":"Sangle Yoga","enrichedDescription":"ce texte est coupé au milieu';
        return { text: truncated, usage: kimi.usage, finishReason: 'length' };
      }
      return kimi.defaultResponder({ step });
    };

    const { createStore } = await import('./store-creator');
    const events = await collectEvents(
      createStore({
        niche: 'yoga équipement',
        storeName: 'Zen Salvage',
        maxProducts: 3,
        mode: 'collection',
        language: 'fr',
      }),
    );

    // No hard failure — the store still ships, with the recoverable subset.
    expect(events.filter((e) => e.type === 'error')).toEqual([]);
    const success = events.find((e) => e.type === 'success');
    expect(success).toBeDefined();
    expect(success!.data).toMatchObject({ productCount: 2, mode: 'collection' });

    const productInserts = captured.filter((q) =>
      q.sql.startsWith('INSERT INTO dropship_store_products'),
    );
    expect(productInserts).toHaveLength(2);

    const activations = captured.filter(
      (q) =>
        q.sql.includes('UPDATE dropship_stores') &&
        q.sql.includes("status = 'active'"),
    );
    expect(activations[0]!.params[8]).toBe(2); // product_count
  });

  it('fails gracefully on unrecoverable truncation (clear error, store marked error)', async () => {
    // Cut off before any element closes → nothing to salvage → must surface the
    // truncation-specific message, not a crash.
    kimi.responder = ({ step }) => {
      if (step === 'enrich-products') {
        return { text: '{"branding": {"tagline": "coupé tout de suite', usage: kimi.usage, finishReason: 'length' };
      }
      return kimi.defaultResponder({ step });
    };

    const { createStore } = await import('./store-creator');
    const events = await collectEvents(
      createStore({
        niche: 'organisateur voiture famille',
        storeName: 'Roadly',
        maxProducts: 12,
        mode: 'collection',
        language: 'fr',
      }),
    );

    // Exactly one error event, no success, terminal 'done'.
    const errors = events.filter((e) => e.type === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/tronquée/i);
    expect(events.find((e) => e.type === 'success')).toBeUndefined();
    expect(events[events.length - 1]!.type).toBe('done');

    // Store row flipped to 'error' with the same message persisted.
    const errorUpdates = captured.filter(
      (q) => q.sql.includes('UPDATE dropship_stores') && q.sql.includes("status='error'"),
    );
    expect(errorUpdates).toHaveLength(1);
    expect(errorUpdates[0]!.params[0]).toMatch(/tronquée/i);
  });

  it('requests a token budget large enough to avoid truncation (root-cause wiring)', async () => {
    const { createStore } = await import('./store-creator');
    await collectEvents(
      createStore({
        niche: 'yoga équipement',
        storeName: 'Zen Budget',
        maxProducts: 12,
        mode: 'collection',
        language: 'fr',
      }),
    );

    const enrichCall = kimi.calls.find((c) => c.meta.step === 'enrich-products');
    expect(enrichCall).toBeDefined();
    // The old bug was a flat 4096 ceiling. The call site must now request a
    // budget scaled to the product count, well above that.
    expect(enrichCall!.opts?.maxTokens).toBeGreaterThanOrEqual(8192);
  });
});
