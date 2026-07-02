import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CubeIcon,
} from '@heroicons/react/16/solid';
import { getDbRead } from '@/lib/db';
import { Text } from '@/components/catalyst/text';
import { Button } from '@/components/catalyst/button';
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
        <AdminStatCard label="En ligne" value={active.length} icon={CheckCircleIcon} />
        <AdminStatCard label="En création" value={creating.length} icon={ClockIcon} />
        <AdminStatCard label="En erreur" value={failed.length} icon={ExclamationTriangleIcon} />
        <AdminStatCard label="Produits publiés" value={totalProducts} icon={CubeIcon} />
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
        <StoresTable rows={tableRows} paginated={totalPages > 1} />
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2">
          <PaginationLink page={page - 1} disabled={page <= 1} label="← Précédent" />
          <Text className="px-3 tabular-nums">
            Page {page} / {totalPages}
          </Text>
          <PaginationLink page={page + 1} disabled={page >= totalPages} label="Suivant →" />
        </nav>
      )}
    </div>
  );
}

function PaginationLink({
  page,
  disabled,
  label,
}: {
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <Button plain disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button plain href={`/admin/stores?page=${page}`}>
      {label}
    </Button>
  );
}
