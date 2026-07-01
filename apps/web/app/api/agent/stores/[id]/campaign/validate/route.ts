import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/stores/:id/campaign/validate
 *
 * Records an operator validation of the campaign page (budget or calendar).
 * Persisted WITHOUT migration in the existing platform_settings key-value
 * table under `campaign_validation:{storeId}` as JSON:
 *   { budgetValidatedAt?: string, calendarValidatedAt?: string }
 *
 * Auth: Basic Auth middleware already guards /api/agent/*.
 */

const KEY_PREFIX = 'campaign_validation:';

interface ValidationState {
  budgetValidatedAt?: string;
  calendarValidatedAt?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  let kind: string | undefined;
  try {
    const body = (await req.json()) as { kind?: string };
    kind = body?.kind;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (kind !== 'budget' && kind !== 'calendar') {
    return NextResponse.json({ error: "kind must be 'budget' or 'calendar'" }, { status: 400 });
  }

  const db = getDb();
  const key = `${KEY_PREFIX}${storeId}`;

  // Read-merge-write so validating one block never erases the other.
  let current: ValidationState = {};
  const existing = await db.query(
    `SELECT value FROM platform_settings WHERE key = $1 LIMIT 1`,
    [key],
  );
  const raw = (existing.rows[0] as { value?: string } | undefined)?.value;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') current = parsed as ValidationState;
    } catch {
      // Unparseable legacy value: start fresh.
    }
  }

  const field = kind === 'budget' ? 'budgetValidatedAt' : 'calendarValidatedAt';
  current[field] = new Date().toISOString();

  await db.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(current)],
  );

  return NextResponse.json({ ok: true, validation: current });
}
