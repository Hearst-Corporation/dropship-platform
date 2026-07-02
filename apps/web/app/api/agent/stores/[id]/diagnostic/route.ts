import { NextRequest, NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { evaluateStoreReadiness, detectSmartComponents } from '@/lib/agent/store-readiness';
import { loadStoreReport } from '@/lib/agent/store-report';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const db = getDbRead();

  const [storeRes, productsRes, runReport] = await Promise.all([
    db.query<{
      id: string;
      slug: string;
      name: string;
      niche: string;
      status: string;
      template: string;
      mode: 'mono' | 'collection';
      hero_image_url: string | null;
      cutout_image_url: string | null;
      lifestyle_images: unknown;
      promo_video_url: string | null;
      assets_status: string;
      landing_content: unknown;
      run_id: string | null;
      error_phase: string | null;
      error_path: string | null;
      error_expected: string | null;
      error_received: string | null;
      error_raw_excerpt: string | null;
      readiness_score: number;
      published_at: string | null;
    }>(
      `SELECT id, slug, name, niche, status, template, mode, hero_image_url, cutout_image_url,
              lifestyle_images, promo_video_url, assets_status, landing_content, run_id,
              error_phase, error_path, error_expected, error_received, error_raw_excerpt,
              readiness_score, published_at
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
      [storeId],
    ),
    db.query<{
      id: string;
      supplier: string;
      enriched_title: string;
      price_cents: number;
      image_url: string | null;
      medusa_product_id: string | null;
    }>(
      `SELECT id, supplier, enriched_title, price_cents, image_url, medusa_product_id
       FROM dropship_store_products WHERE store_id = $1 ORDER BY created_at ASC`,
      [storeId],
    ),
    loadStoreReport(db, storeId),
  ]);

  const store = storeRes.rows[0];
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const readiness = await evaluateStoreReadiness(storeId);
  const smartComponents = detectSmartComponents(store.landing_content);

  return NextResponse.json({
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      niche: store.niche,
      status: store.status,
      template: store.template,
      mode: store.mode,
      runId: store.run_id,
      assetsStatus: store.assets_status,
      heroImageUrl: store.hero_image_url,
      cutoutImageUrl: store.cutout_image_url,
      lifestyleImages: Array.isArray(store.lifestyle_images) ? store.lifestyle_images : [],
      promoVideoUrl: store.promo_video_url,
      readinessScore: store.readiness_score,
      publishedAt: store.published_at,
    },
    error: {
      phase: store.error_phase,
      path: store.error_path,
      expected: store.error_expected,
      received: store.error_received,
      rawExcerpt: store.error_raw_excerpt,
    },
    readiness,
    smartComponents,
    products: productsRes.rows,
    report: runReport,
  });
}
