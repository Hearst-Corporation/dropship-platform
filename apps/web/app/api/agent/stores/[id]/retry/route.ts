import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { createStore } from '@/lib/agent/store-creator';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) {
    return new Response(JSON.stringify({ error: 'Store not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rl = await checkRateLimit(`create-store:${clientIp(_req)}`, { max: 60, windowSec: 60 });
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: `Rate limit reached. Retry in ${rl.retryAfterSec}s.` }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) },
      },
    );
  }

  const db = getDb();
  const storeRes = await db.query<{
    name: string;
    niche: string;
    mode: 'mono' | 'collection';
    language: 'fr' | 'en';
    template: string;
    brief: string | null;
    markets: string[] | null;
  }>(
    `SELECT name, niche, mode, language, template, brief, markets
     FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) {
    return new Response(JSON.stringify({ error: 'Store not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Reset the draft to a clean state so the idempotency gate resumes it.
  await db.query(
    `UPDATE dropship_stores
     SET status = 'draft', error_message = NULL, error_phase = NULL, error_path = NULL,
         error_expected = NULL, error_received = NULL, error_raw_excerpt = NULL,
         readiness_score = 0, updated_at = now()
     WHERE id = $1`,
    [storeId],
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client disconnect
        }
      };

      try {
        for await (const event of createStore({
          niche: store.niche,
          storeName: store.name,
          mode: store.mode,
          language: store.language,
          template: store.template,
          brief: store.brief ?? undefined,
          markets: store.markets ?? undefined,
        })) {
          send(event);
          if (event.type === 'done' || event.type === 'error') break;
        }
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Erreur serveur' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
