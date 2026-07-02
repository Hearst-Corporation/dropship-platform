import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CubeIcon,
} from "@heroicons/react/16/solid";
import { getDbRead } from "@/lib/db";
import { Text } from "@/components/catalyst/text";
import { Button } from "@/components/catalyst/button";
import {
  Pagination,
  PaginationPrevious,
  PaginationNext,
  PaginationList,
} from "@/components/catalyst/pagination";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StoresTable, type StoresTableRow } from "./StoresTable";

export const dynamic = "force-dynamic";

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
    ? (s.lifestyle_images as unknown[]).filter(
        (u): u is string => typeof u === "string",
      )
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
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
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
  const stats = statsRes.rows[0] ?? {
    total: 0,
    active: 0,
    creating: 0,
    failed: 0,
    total_products: 0,
  };
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
          <>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2 py-0.5 font-medium uppercase tracking-wide text-indigo-400 ring-1 ring-inset ring-indigo-500/20 text-indigo-400 ring-indigo-400/25">
              Production · Agent IA
            </span>
          </>
        }
        actions={
          <Button color="indigo" href="/admin/stores/new">
            Nouveau store
          </Button>
        }
      />

      <AdminStatsGrid>
        <AdminStatCard
          label="En ligne"
          value={stats.active}
          icon={CheckCircleIcon}
        />
        <AdminStatCard
          label="En création"
          value={stats.creating}
          icon={ClockIcon}
        />
        <AdminStatCard
          label="En erreur"
          value={stats.failed}
          icon={ExclamationTriangleIcon}
        />
        <AdminStatCard
          label="Produits publiés"
          value={stats.total_products}
          icon={CubeIcon}
        />
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
        <Pagination className="pt-2">
          <PaginationPrevious
            href={page > 1 ? `/admin/stores?page=${page - 1}` : null}
          >
            Précédent
          </PaginationPrevious>
          <PaginationList>
            <Text className="px-3 tabular-nums">
              Page {page} / {totalPages}
            </Text>
          </PaginationList>
          <PaginationNext
            href={page < totalPages ? `/admin/stores?page=${page + 1}` : null}
          >
            Suivant
          </PaginationNext>
        </Pagination>
      )}
    </div>
  );
}
