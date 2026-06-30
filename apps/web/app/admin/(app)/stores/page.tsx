import Link from 'next/link';
import Image from 'next/image';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { getDbRead } from '@/lib/db';
import { StoreAvatar } from '@/components/ui';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatGrid, AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminCard } from '@/components/admin/AdminCard';
import { AdminBadge, type AdminBadgeColor } from '@/components/admin/AdminBadge';
import { StoreActions } from './StoreActions';

export const dynamic = 'force-dynamic';

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  tagline: string;
  logo_emoji: string;
  primary_color: string;
  accent_color: string;
  status: string;
  product_count: number;
  created_at: string;
  error_message: string | null;
  hero_image_url: string | null;
  cutout_image_url: string | null;
  lifestyle_images: unknown;
}

function pickStoreCover(s: StoreRow): string | null {
  if (s.hero_image_url) return s.hero_image_url;
  const lifestyles = Array.isArray(s.lifestyle_images)
    ? (s.lifestyle_images as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];
  if (lifestyles[0]) return lifestyles[0];
  if (s.cutout_image_url) return s.cutout_image_url;
  return null;
}

function statusOf(s: StoreRow): { color: AdminBadgeColor; label: string } {
  if (s.status === 'active') return { color: 'green', label: 'En ligne' };
  if (s.status === 'creating') return { color: 'amber', label: 'Création en cours' };
  return { color: 'red', label: 'Erreur' };
}

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = 24;
  const offset = (page - 1) * pageSize;

  const db = getDbRead();

  const countRes = await db.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM dropship_stores`,
  );
  const total = countRes.rows[0]?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const { rows } = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, tagline, logo_emoji, primary_color, accent_color,
            status, product_count, error_message, created_at,
            hero_image_url, cutout_image_url, lifestyle_images
     FROM dropship_stores ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset],
  );

  const active = rows.filter((s) => s.status === 'active');
  const creating = rows.filter((s) => s.status === 'creating');
  const failed = rows.filter((s) => s.status !== 'active' && s.status !== 'creating');
  const totalProducts = active.reduce((acc, s) => acc + (s.product_count || 0), 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Production · Agent IA"
        title="Stores dropshipping"
        description="L'agent recherche les produits, enrichit les fiches puis publie le store Medusa complet."
        actions={
          <Link
            href="/admin/stores/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <span aria-hidden className="text-base leading-none">+</span> Nouveau store
          </Link>
        }
      />

      <AdminStatGrid>
        <AdminStatCard label="En ligne" value={String(active.length)} />
        <AdminStatCard label="En création" value={String(creating.length)} />
        <AdminStatCard label="En erreur" value={String(failed.length)} />
        <AdminStatCard label="Produits publiés" value={String(totalProducts)} />
      </AdminStatGrid>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <AdminCard className="overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th scope="col" className="py-3 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Store</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Niche</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Statut</th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Produits</th>
                <th scope="col" className="py-3 pl-3 pr-6 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {rows.map((store) => {
                const s = statusOf(store);
                const cover = pickStoreCover(store);
                return (
                  <tr key={store.id} className="hover:bg-zinc-50">
                    <td className="py-3 pl-6 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                          {cover ? (
                            <Image src={cover} alt="" fill sizes="36px" className="object-cover" />
                          ) : (
                            <StoreAvatar slug={store.slug} name={store.name} size={36} className="size-full rounded-none" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-900">{store.name}</div>
                          <div className="truncate text-xs tabular-nums text-zinc-400">/shop/{store.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-500">{store.niche}</td>
                    <td className="px-3 py-3"><AdminBadge color={s.color}>{s.label}</AdminBadge></td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-zinc-600">{store.product_count}</td>
                    <td className="py-3 pl-3 pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/stores/${store.id}`}
                          className="rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
                        >
                          Gérer
                        </Link>
                        {store.status === 'active' && (
                          <Link
                            href={`/shop/${store.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Ouvrir la boutique"
                            title="Ouvrir la boutique"
                            className="inline-flex size-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                          >
                            <ArrowTopRightOnSquareIcon className="size-3.5" aria-hidden />
                          </Link>
                        )}
                        <StoreActions storeId={store.id} storeName={store.name} compact />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminCard>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2">
          <PaginationLink page={page - 1} disabled={page <= 1} label="← Précédent" />
          <span className="px-3 text-sm tabular-nums text-zinc-400">Page {page} / {totalPages}</span>
          <PaginationLink page={page + 1} disabled={page >= totalPages} label="Suivant →" />
        </nav>
      )}
    </div>
  );
}

function PaginationLink({ page, disabled, label }: { page: number; disabled: boolean; label: string }) {
  if (disabled) {
    return <span className="cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-zinc-300">{label}</span>;
  }
  return (
    <Link
      href={`/admin/stores?page=${page}`}
      className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
    >
      {label}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Premier pas</p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-900">Lance ton premier store.</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
        L&apos;agent IA recherche les produits, génère les visuels, écrit les fiches et publie le store. Une niche suffit.
      </p>
      <div className="mt-6">
        <Link
          href="/admin/stores/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Créer un store
        </Link>
      </div>
    </div>
  );
}
