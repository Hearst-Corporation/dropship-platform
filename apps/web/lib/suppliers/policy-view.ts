// Read-only view model for the Suppliers settings page.
// Merges the code-level constants (registry + exclusion list) with the
// optional `dropship_suppliers` DB table introduced in migration 032.
// The DB table may not exist yet — every DB call is wrapped in try/catch
// and falls back gracefully to the code constants.
import { getDbRead } from '@/lib/db';
import { listSuppliers } from './registry';
import { EXCLUDED_PLATFORMS } from './policy';

export type SupplierPolicyRow = {
  id: string;
  label: string;
  tier?: string;
  status: string;
  capabilities: Record<string, boolean>;
  exclusionReason?: string;
  exclusionNote?: string;
  connectionState: string;
};

// DB row shape returned by the dropship_suppliers table (migration 032).
interface DbSupplierRow {
  id: string;
  label: string;
  tier: string | null;
  status: string;
  capabilities: Record<string, boolean> | null;
  exclusion_reason: string | null;
  exclusion_note: string | null;
  connection_state: string;
  last_checked_at: Date | null;
}

/** Sort weight so active/feed-only/search_only come before automation then excluded. */
function sortWeight(status: string): number {
  if (status === 'active') return 0;
  if (status === 'feed-only') return 1;
  if (status === 'search_only') return 2;
  if (status === 'automation') return 3;
  return 4; // excluded
}

/** Build the fallback view purely from code constants — no DB needed. */
function buildFromConstants(): SupplierPolicyRow[] {
  const rows: SupplierPolicyRow[] = [];

  // Active / sourcing suppliers from the registry manifest.
  for (const s of listSuppliers()) {
    rows.push({
      id: s.id,
      label: s.label,
      tier: s.tier,
      status: s.status,
      capabilities: s.capabilities as unknown as Record<string, boolean>,
      connectionState: 'unknown',
    });
  }

  // AutoDS automation layer.
  rows.push({
    id: 'autods',
    label: 'AutoDS (automation)',
    status: 'automation',
    capabilities: {},
    connectionState: 'unknown',
  });

  // Excluded platforms from the blocklist.
  for (const p of EXCLUDED_PLATFORMS) {
    rows.push({
      id: p.id,
      label: p.label,
      status: 'excluded',
      capabilities: {},
      exclusionReason: p.reason,
      exclusionNote: p.note,
      connectionState: 'unknown',
    });
  }

  return rows;
}

/**
 * Returns the merged supplier policy view.
 *
 * Strategy:
 * 1. Try reading `dropship_suppliers` from the DB (migration 032).
 * 2. On ANY error (table absent, connection issue, etc.) fall back to constants.
 * 3. When DB rows are present, merge: DB row wins over the matching constant row.
 * 4. Rows present only in code constants but absent from DB are appended.
 * 5. Final list is sorted: active/feed-only/search_only → automation → excluded.
 */
export async function getSupplierPolicyView(): Promise<SupplierPolicyRow[]> {
  let dbRows: DbSupplierRow[] = [];

  try {
    const db = getDbRead();
    const { rows } = await db.query<DbSupplierRow>(
      `SELECT id, label, tier, status, capabilities, exclusion_reason, exclusion_note,
              connection_state, last_checked_at
       FROM dropship_suppliers
       ORDER BY id`,
    );
    dbRows = rows;
  } catch {
    // Table absent or DB unreachable — fall back to code constants entirely.
    return buildFromConstants().sort((a, b) => sortWeight(a.status) - sortWeight(b.status));
  }

  // DB returned rows — merge with code constants so nothing is missing.
  const merged = new Map<string, SupplierPolicyRow>();

  // Seed with code constants first (lower priority).
  for (const r of buildFromConstants()) {
    merged.set(r.id, r);
  }

  // DB rows overwrite constants (higher priority).
  for (const r of dbRows) {
    merged.set(r.id, {
      id: r.id,
      label: r.label,
      tier: r.tier ?? undefined,
      status: r.status,
      capabilities: r.capabilities ?? {},
      exclusionReason: r.exclusion_reason ?? undefined,
      exclusionNote: r.exclusion_note ?? undefined,
      connectionState: r.connection_state,
    });
  }

  return Array.from(merged.values()).sort((a, b) => sortWeight(a.status) - sortWeight(b.status));
}
