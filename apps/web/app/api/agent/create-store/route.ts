import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createStore } from '@/lib/agent/store-creator';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { TEMPLATE_IDS } from '@/lib/template-catalog';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const schema = z.object({
  niche: z.string().min(2).max(100),
  storeName: z.string().min(2).max(80),
  // mono = single hero SKU + auto hero/lifestyle/video assets.
  // collection = 3-25 SKU catalogue, no asset gen.
  mode: z.enum(['mono', 'collection']).optional().default('collection'),
  // Used only in collection mode (mono is forced to 1 server-side).
  maxProducts: z.number().int().min(1).max(25).optional().default(12),
  language: z.enum(['fr', 'en']).optional().default('fr'),
  // Mono mode only: skip the 5s promo video (faster + saves credits).
  skipVideo: z.boolean().optional().default(false),
  // Design system locked at creation: which preset + the primary/accent the
  // operator confirmed in the chat. Optional — store-creator falls back to
  // editorial-serif + neutral palette if missing (legacy callers).
  designPreset: z
    .enum([
      'editorial-serif',
      'tech-mono',
      'brutalist-luxe',
      'gen-z-bold',
      'lifestyle-warm',
    ])
    .optional(),
  primaryColor: Hex.optional(),
  accentColor: Hex.optional(),
  // Storefront template id from the catalog. The research-copilot suggests
  // one via `shortlist_niche.suggested_template`; the operator can override
  // it in the form before clicking "Lancer". When the template's register
  // is 'luxury', the asset generator + landing writer switch to maison voice.
  template: z.enum(TEMPLATE_IDS as unknown as [string, ...string[]]).optional(),
  // Free-form operator brief: constraints on margins, shipping, compliance,
  // excluded product families. Steers selection, enrichment and the ads plan.
  brief: z.string().max(4000).optional(),
  // Target markets as ISO country codes (['FR', 'AE'], max 5).
  markets: z
    .array(z.string().regex(/^[A-Za-z]{2,3}$/))
    .max(5)
    .optional(),
});

export async function POST(req: NextRequest) {
  // Route is already gated by Basic Auth in middleware, so the only caller is
  // the admin. Keep a soft ceiling so a runaway loop can't burn credits, but
  // don't make it tight enough to bite during normal iteration.
  const rl = await checkRateLimit(`create-store:${clientIp(req)}`, { max: 60, windowSec: 60 });
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: `Rate limit reached. Retry in ${rl.retryAfterSec}s.` }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfterSec),
        },
      },
    );
  }

  let input;
  try {
    const body = await req.json();
    input = schema.parse(body);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid input' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        for await (const event of createStore(input)) {
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
