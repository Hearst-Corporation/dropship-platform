import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { evaluateStoreReadiness } from '@/lib/agent/store-readiness';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const db = getDb();

  const readiness = await evaluateStoreReadiness(storeId);
  if (!readiness.canPublish) {
    return NextResponse.json(
      {
        error: 'Store not ready for publication',
        readiness,
      },
      { status: 422 },
    );
  }

  await db.query(
    `UPDATE dropship_stores
     SET status = 'published', published_at = now(), updated_at = now()
     WHERE id = $1`,
    [storeId],
  );

  return NextResponse.json({ success: true, readiness });
}
