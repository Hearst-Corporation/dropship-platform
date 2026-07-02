import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CubeIcon,
} from '@heroicons/react/16/solid';
import { getDbRead } from '@/lib/db';
import { Text } from '@/components/catalyst/text';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { Button } from '@/components/catalyst/button';
import {
  Pagination,
  PaginationPrevious,
  PaginationNext,
  PaginationList,
} from '@/components/catalyst/pagination';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { StoresTable, type StoresTableRow } from './StoresTable';

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

function statusOf(s: StoreRow): { status: string; label: string } {
  if (s.status === 'active') return { status: 'active', label: 'En ligne' };
  if (s.status === 'creating') return { status: 'creating', label: 'Création en cours' };
  return { status: 'error', label: 'Erreur' };
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

  // Global aggregates: the stat cards show platform-wide totals, not just the
  // current page (LIMIT/OFFSET below only feeds the table).
  const statsRes = await db.query<{
    total: number;
    active: number;
    creating: number;
    failed: number;
    total_products: number;
  }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active,
            COUNT(*) FILTER (WHERE status = 'creating')::int AS creating,
            COUNT(*) FILTER (WHERE status NOT IN ('active', 'creating'))::int AS failed,
            COALESCE(SUM(product_count) FILTER (WHERE status = 'active'), 0)::int AS total_products
     FROM dropship_stores`,
  );
  const stats = statsRes.rows[0] ?? { total: 0, active: 0, creating: 0, failed: 0, total_products: 0 };
  const total = stats.total;
  const totalPages = Math.ceil(total / pageSize);

  const { rows } = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, tagline, logo_emoji, primary_color, accent_color,
            status, product_count, error_message, created_at,
            hero_image_url, cutout_image_url, lifestyle_images
     FROM dropship_stores ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset],
  );

  const tableRows: StoresTableRow[] = rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    niche: s.niche,
    status: s.status,
    product_count: s.product_count,
    created_at: s.created_at,
    error_message: s.error_message,
    cover: pickStoreCover(s),
  }));

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Stores dropshipping"
        subtitle="L'agent recherche les produits, enrichit les fiches puis publie le store Medusa complet."
        meta={
          <span className="font-medium uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
            Production · Agent IA
          </span>
        }
        actions={
          <Button color="indigo" href="/admin/stores/new">
            Nouveau store
          </Button>
        }
      />

      <AdminStatsGrid>
        <AdminStatCard label="En ligne" value={stats.active} icon={CheckCircleIcon} />
        <AdminStatCard label="En création" value={stats.creating} icon={ClockIcon} />
        <AdminStatCard label="En erreur" value={stats.failed} icon={ExclamationTriangleIcon} />
        <AdminStatCard label="Produits publiés" value={stats.total_products} icon={CubeIcon} />
      </AdminStatsGrid>

      {total === 0 ? (
        <AdminEmptyState
          icon={BuildingStorefrontIcon}
          title="Lance ton premier store."
          description="L'agent IA recherche les produits, génère les visuels, écrit les fiches et publie le store. Une niche suffit."
          action={
            <Button color="indigo" href="/admin/stores/new">
              Créer un store
            </Button>
          }
        />
      ) : (
        <Table dense className="min-w-0">
          <TableHead>
            <TableRow>
              <TableHeader>Store</TableHeader>
              <TableHeader>Niche</TableHeader>
              <TableHeader>Statut</TableHeader>
              <TableHeader className="text-right">Produits</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
              {rows.map((store) => {
                const s = statusOf(store);
                const cover = pickStoreCover(store);
                return (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-950/10 dark:bg-white/5 dark:ring-white/10">
                          {cover ? (
                            <Image src={cover} alt={store.name} fill sizes="36px" className="object-cover" />
                          ) : (
                            <StoreAvatar
                              slug={store.slug}
                              name={store.name}
                              size={36}
                              className="size-full rounded-none"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-zinc-950 dark:text-white">
                            {store.name}
                          </div>
                          <div className="truncate text-xs tabular-nums text-zinc-500">
                            /shop/{store.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-500">{store.niche}</TableCell>
                    <TableCell>
                      <AdminBadge status={s.status}>{s.label}</AdminBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500">
                      {store.product_count}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button plain href={`/admin/stores/${store.id}`}>
                          Gérer
                        </Button>
                        {store.status === 'active' && (
                          <Button
                            plain
                            href={`/shop/${store.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Ouvrir la boutique"
                            title="Ouvrir la boutique"
                          >
                            <ArrowTopRightOnSquareIcon aria-hidden />
                          </Button>
                        )}
                        <StoreActions storeId={store.id} storeName={store.name} compact />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <Pagination className="pt-2">
          <PaginationPrevious href={page > 1 ? `/admin/stores?page=${page - 1}` : null}>
            Précédent
          </PaginationPrevious>
          <PaginationList>
            <Text className="px-3 tabular-nums">
              Page {page} / {totalPages}
            </Text>
          </PaginationList>
          <PaginationNext href={page < totalPages ? `/admin/stores?page=${page + 1}` : null}>
            Suivant
          </PaginationNext>
        </Pagination>
      )}
    </div>
  );
}
