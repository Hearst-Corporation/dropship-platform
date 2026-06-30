import { notFound } from 'next/navigation';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { ASSET_KINDS, type AssetKind } from '@/lib/agent/asset-regenerator';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AssetRegenerator } from './AssetRegenerator';

export const dynamic = 'force-dynamic';

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  hero_image_url: string | null;
  cutout_image_url: string | null;
  lifestyle_images: unknown;
  promo_video_url: string | null;
}

interface RunRow {
  id: string;
  asset_kind: AssetKind | 'all';
  prompt: string | null;
  reference_image_url: string | null;
  result_url: string | null;
  status: 'pending' | 'running' | 'success' | 'error';
  error_message: string | null;
  is_current: boolean;
  created_at: Date | string;
  completed_at: Date | string | null;
}

interface ProductRow {
  enriched_title: string | null;
  image_url: string | null;
}

export default async function StoreAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  const storeRes = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, hero_image_url, cutout_image_url, lifestyle_images, promo_video_url
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const productRes = await db.query<ProductRow>(
    `SELECT enriched_title, image_url
       FROM dropship_store_products
      WHERE store_id = $1 AND image_url IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 1`,
    [storeId],
  );
  const product = productRes.rows[0] ?? null;

  const runsRes = await db.query<RunRow>(
    `SELECT id, asset_kind, prompt, reference_image_url, result_url, status,
            error_message, is_current, created_at, completed_at
       FROM dropship_asset_runs
      WHERE store_id = $1
      ORDER BY created_at DESC
      LIMIT 200`,
    [storeId],
  );

  // Group runs by asset_kind, cap at 10 per slot for the history strip.
  const grouped: Record<AssetKind, RunRow[]> = {
    hero: [],
    cutout: [],
    'lifestyle-1': [],
    'lifestyle-2': [],
    'lifestyle-3': [],
    promo: [],
  };
  for (const r of runsRes.rows) {
    const k = r.asset_kind;
    if (k === 'all') continue;
    if (grouped[k].length < 10) grouped[k].push(r);
  }

  const lifestyleImages = Array.isArray(store.lifestyle_images)
    ? (store.lifestyle_images as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];

  const currentUrlByKind: Record<AssetKind, string | null> = {
    hero: store.hero_image_url,
    cutout: store.cutout_image_url,
    'lifestyle-1': lifestyleImages[0] ?? null,
    'lifestyle-2': lifestyleImages[1] ?? null,
    'lifestyle-3': lifestyleImages[2] ?? null,
    promo: store.promo_video_url,
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <AdminPageHeader
        eyebrow={`Production · Assets · ${store.niche}`}
        title={
          <>
            Assets de <em className="italic text-gray-400">{store.name}</em>
          </>
        }
        description={
          <>
            Régénère chaque visuel sans toucher au produit. Le prompt est éditable, l&apos;historique
            conserve les 10 derniers runs et un clic suffit pour revenir à une version précédente. Le
            storefront{' '}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-gray-400 ring-1 ring-white/10">
              /shop/{store.slug}
            </code>{' '}
            reflète immédiatement la version courante.
          </>
        }
      />

      {!product?.image_url && (
        <div className="rounded-xl bg-amber-500/10 px-5 py-4 text-sm text-amber-400 ring-1 ring-amber-500/20">
          <strong className="font-semibold">Aucun produit de référence.</strong> Aucune image produit
          n&apos;est associée à ce store, la régénération ne peut pas s&apos;appuyer sur un visuel
          source. Importe un produit avec une image avant d&apos;utiliser cette page.
        </div>
      )}

      <div className="flex flex-col gap-6">
        {ASSET_KINDS.map((kind) => (
          <AssetRegenerator
            key={kind}
            storeId={store.id}
            kind={kind}
            currentUrl={currentUrlByKind[kind]}
            runs={grouped[kind].map((r) => ({
              id: r.id,
              prompt: r.prompt,
              resultUrl: r.result_url,
              status: r.status,
              errorMessage: r.error_message,
              isCurrent: r.is_current,
              createdAt: typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString(),
            }))}
            referenceImageUrl={product?.image_url ?? null}
          />
        ))}
      </div>
    </div>
  );
}
