import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const db = getDb();
  await db.query(
    `UPDATE dropship_stores
     SET status = 'ready', published_at = NULL, updated_at = now()
     WHERE id = $1 AND status = 'published'`,
    [storeId],
  );

  return NextResponse.json({ success: true });
}
