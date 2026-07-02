/**
 * Structured run report for the store-creator pipeline.
 *
 * Persisted in the EXISTING `platform_settings` key-value table under
 * `store_report:{storeId}` — no new migration required. The report is the
 * source of truth the admin reads for everything the run decided that has no
 * dedicated column: brief, target markets, supplier policy outcome, per-product
 * risk/status, asset strategy, the Google Ads launch plan and the event log.
 */

import type { GoogleAdsPlan } from './ads-planner';

export interface SupplierRunOutcome {
  id: string;
  label: string;
  tier?: string;
  /** Registry status: active | search_only | feed-only | automation | excluded */
  status: string;
  /** Passed the dropship-pur gate and was queried during this run. */
  considered: boolean;
  /** Eligible per policy (hard criteria met, not excluded). */
  eligible: boolean;
  /** Products returned by this supplier during the run. */
  productsFound: number;
  /** FR explanation: why used / why skipped / why excluded. */
  reason: string;
}

export interface ProductRunReport {
  externalId: string;
  supplier: string;
  title: string;
  priceCents: number;
  costCents: number;
  /** Gross margin percent, null when cost is unknown. */
  marginPct: number | null;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  /** Short FR note on FR + target market fit. */
  marketFit: string;
  status: 'imported' | 'import_failed' | 'local_only' | 'proposed';
  reason: string;
  imageUrl: string | null;
}

export interface StoreRunReport {
  version: 1;
  storeId: string;
  storeName: string;
  slug: string;
  niche: string;
  mode: 'mono' | 'collection';
  language: 'fr' | 'en';
  /** Storefront template resolved at creation (operator choice or agent pick). */
  template: string;
  brief: string | null;
  markets: string[];
  suppliers: SupplierRunOutcome[];
  products: ProductRunReport[];
  assets: {
    /** generated = pipeline GPU/fal ok · supplier-images = photos fournisseur ·
     *  placeholder = image de secours déterministe · pending_generation = file d'attente */
    status: 'generated' | 'supplier-images' | 'placeholder' | 'pending_generation';
    notes: string;
    /** FLUX prompt persisted when the hero could not be generated (replayable). */
    heroPrompt?: string;
  };
  adsPlan: GoogleAdsPlan | null;
  events: Array<{ ts: string; type: string; message: string }>;
  createdAt: string;
}

const KEY_PREFIX = 'store_report:';

interface Queryable {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
}

/** Upsert the run report. Never throws — a report failure must not kill a run. */
export async function saveStoreReport(db: Queryable, report: StoreRunReport): Promise<boolean> {
  try {
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [`${KEY_PREFIX}${report.storeId}`, JSON.stringify(report)],
    );
    return true;
  } catch (e) {
    console.error('[store-report] save failed', {
      storeId: report.storeId,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/** Load a run report; null when absent or unparseable. */
export async function loadStoreReport(db: Queryable, storeId: string): Promise<StoreRunReport | null> {
  try {
    const res = await db.query(
      `SELECT value FROM platform_settings WHERE key = $1 LIMIT 1`,
      [`${KEY_PREFIX}${storeId}`],
    );
    const row = res.rows[0] as { value?: string } | undefined;
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as StoreRunReport;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}
