import Link from 'next/link';
import { ArrowUpRightIcon } from '@heroicons/react/20/solid';
import { getDbRead } from '@/lib/db';
import { StoreAvatar } from '@/components/ui';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatGrid, AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminCard, AdminCardHeader } from '@/components/admin/AdminCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Portfolio dashboard — aggregates KPIs across every store. All queries hit the
 * read replica and fail-soft individually (one slow source never blocks the page).
 * Data layer preserved verbatim from the pre-reset dashboard; UI rebuilt on
 * Tailwind Plus blocks (stats + cards).
 */
interface StoresRow {
  active: number;
  created_7d: number;
  total_products: number;
  products_7d: number;
}
interface RevenueRow {
  revenue_30d_cents: number;
  revenue_7d_cents: number;
  orders_30d: number;
  orders_7d: number;
  aov_30d_cents: number;
}
interface FunnelRow {
  view_content: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchase: number;
}
interface TopStoreRow {
  slug: string;
  name: string;
  logo_emoji: string;
  revenue_cents: number;
  orders: number;
}
interface CostRow {
  total_cost_eur: string;
  runs: number;
  errors: number;
  avg_cost_per_run: string;
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error('[dashboard] query failed:', e instanceof Error ? e.message : e);
    return fallback;
  }
}

function eur(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

export default async function PortfolioDashboard() {
  const db = getDbRead();

  const [stores, revenue, funnel, topStores, cost] = await Promise.all([
    safeQuery<StoresRow>(
      async () => {
        const { rows } = await db.query<StoresRow>(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS created_7d,
             COALESCE(SUM(product_count) FILTER (WHERE status = 'active'), 0)::int AS total_products,
             COALESCE(SUM(product_count) FILTER (WHERE created_at > now() - interval '7 days'), 0)::int AS products_7d
           FROM dropship_stores`,
        );
        return rows[0]!;
      },
      { active: 0, created_7d: 0, total_products: 0, products_7d: 0 },
    ),
    safeQuery<RevenueRow>(
      async () => {
        const { rows } = await db.query<RevenueRow>(
          `SELECT
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days'), 0)::bigint AS revenue_30d_cents,
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '7 days'), 0)::bigint AS revenue_7d_cents,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days')::int AS orders_30d,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '7 days')::int AS orders_7d,
             COALESCE(AVG(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days'), 0)::bigint AS aov_30d_cents
           FROM dropship_funnel_events`,
        );
        return rows[0]!;
      },
      { revenue_30d_cents: 0, revenue_7d_cents: 0, orders_30d: 0, orders_7d: 0, aov_30d_cents: 0 },
    ),
    safeQuery<FunnelRow>(
      async () => {
        const { rows } = await db.query<FunnelRow>(
          `SELECT
             COUNT(*) FILTER (WHERE event_name = 'view_content')::int AS view_content,
             COUNT(*) FILTER (WHERE event_name = 'add_to_cart')::int AS add_to_cart,
             COUNT(*) FILTER (WHERE event_name = 'initiate_checkout')::int AS initiate_checkout,
             COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS purchase
           FROM dropship_funnel_events
           WHERE created_at > now() - interval '30 days'`,
        );
        return rows[0]!;
      },
      { view_content: 0, add_to_cart: 0, initiate_checkout: 0, purchase: 0 },
    ),
    safeQuery<TopStoreRow[]>(
      async () => {
        const { rows } = await db.query<TopStoreRow>(
          `SELECT
             s.slug, s.name, s.logo_emoji,
             COALESCE(SUM(f.value_minor), 0)::bigint AS revenue_cents,
             COUNT(f.id)::int AS orders
           FROM dropship_stores s
           LEFT JOIN dropship_funnel_events f
             ON f.store_slug = s.slug
            AND f.event_name = 'purchase'
            AND f.created_at > now() - interval '7 days'
           WHERE s.status = 'active'
           GROUP BY s.slug, s.name, s.logo_emoji, s.created_at
           ORDER BY revenue_cents DESC NULLS LAST, s.created_at DESC
           LIMIT 7`,
        );
        return rows;
      },
      [],
    ),
    safeQuery<CostRow>(
      async () => {
        const { rows } = await db.query<CostRow>(
          `SELECT
             COALESCE(SUM(cost_eur), 0)::numeric(12,4)::text AS total_cost_eur,
             COUNT(*)::int AS runs,
             COUNT(*) FILTER (WHERE error_json IS NOT NULL)::int AS errors,
             COALESCE(AVG(cost_eur), 0)::numeric(12,6)::text AS avg_cost_per_run
           FROM dropship_ai_runs
           WHERE created_at > now() - interval '30 days'`,
        );
        return rows[0]!;
      },
      { total_cost_eur: '0', runs: 0, errors: 0, avg_cost_per_run: '0' },
    ),
  ]);

  const revenue30dCents = Number(revenue.revenue_30d_cents);
  const revenue7dCents = Number(revenue.revenue_7d_cents);
  const totalCost = Number(cost.total_cost_eur || 0);
  const avgPerRun = Number(cost.avg_cost_per_run || 0);
  const errorRate = cost.runs ? (cost.errors / cost.runs) * 100 : 0;
  const globalConv = funnel.view_content > 0 ? (funnel.purchase / funnel.view_content) * 100 : 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Portfolio"
        title="Vue d'ensemble"
        description="KPIs agrégés sur tous les stores actifs. Cliquez sur un bloc pour drill down."
      />

      <AdminStatGrid>
        <AdminStatCard label="Stores actifs" value={stores.active.toLocaleString('fr-FR')} href="/admin/stores" hint={`+${stores.created_7d} sur 7j`} />
        <AdminStatCard label="Produits" value={stores.total_products.toLocaleString('fr-FR')} href="/admin/catalog" hint={`+${stores.products_7d} sur 7j`} />
        <AdminStatCard label="CA 30j" value={eur(revenue30dCents)} hint={`${revenue.orders_30d} commandes`} />
        <AdminStatCard label="CA 7j" value={eur(revenue7dCents)} hint={`${revenue.orders_7d} commandes`} />
      </AdminStatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top stores */}
        <AdminCard>
          <AdminCardHeader
            eyebrow="Performance 7j"
            title="Top stores"
            action={
              <Link href="/admin/stores" className="inline-flex items-center gap-0.5 text-xs font-medium text-indigo-600 hover:text-indigo-500">
                Tous <ArrowUpRightIcon className="size-3.5" aria-hidden />
              </Link>
            }
          />
          <div className="px-5 py-4">
            {topStores.length === 0 ? (
              <p className="py-2 text-sm text-zinc-400">Aucun store actif avec des ventes 7j.</p>
            ) : (
              <ul role="list" className="divide-y divide-zinc-100">
                {topStores.map((s, idx) => (
                  <li key={s.slug}>
                    <Link href={`/admin/stores/${s.slug}`} className="flex items-center gap-3 py-2.5 hover:bg-zinc-50">
                      <span className="w-4 text-right text-xs tabular-nums text-zinc-400">{idx + 1}</span>
                      <StoreAvatar slug={s.slug} name={s.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-900">{s.name}</div>
                        <div className="truncate text-xs tabular-nums text-zinc-400">/shop/{s.slug}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={revenueClass(Number(s.revenue_cents))}>{eur(Number(s.revenue_cents))}</div>
                        <div className="text-xs tabular-nums text-zinc-400">{s.orders} cmd</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AdminCard>

        {/* Funnel */}
        <AdminCard>
          <AdminCardHeader
            eyebrow="Funnel 30j"
            title="Conversion globale"
            action={<span className="text-xs font-semibold tabular-nums text-zinc-900">{globalConv.toFixed(1)}%</span>}
          />
          <div className="space-y-4 px-5 py-4">
            <FunnelBar label="View content" value={funnel.view_content} reference={funnel.view_content} />
            <FunnelBar label="Add to cart" value={funnel.add_to_cart} reference={funnel.view_content} />
            <FunnelBar label="Initiate checkout" value={funnel.initiate_checkout} reference={funnel.view_content} />
            <FunnelBar label="Purchase" value={funnel.purchase} reference={funnel.view_content} highlight />
          </div>
        </AdminCard>

        {/* Coût agent */}
        <AdminCard>
          <AdminCardHeader eyebrow="Coût Claude 30j" title="Observabilité agent" />
          <div className="space-y-4 px-5 py-4">
            <div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">
                {totalCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </div>
              <div className="mt-1 text-xs text-zinc-500">Total des appels agent</div>
            </div>
            <dl className="space-y-2 text-sm">
              <StatRow label="Runs" value={cost.runs.toLocaleString('fr-FR')} />
              <StatRow label="Coût moyen / run" value={`${(avgPerRun * 1000).toFixed(3)} m€`} />
              <StatRow label="Taux d'erreur" value={`${errorRate.toFixed(1)}%`} warning={errorRate > 5} />
            </dl>
            <Link
              href="/admin/observability"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
            >
              Détail par step <ArrowUpRightIcon className="size-3.5" aria-hidden />
            </Link>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

function revenueClass(cents: number): string {
  return cents > 0
    ? 'text-sm font-semibold tabular-nums text-zinc-900'
    : 'text-sm font-semibold tabular-nums text-zinc-400';
}

function StatRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={warning ? 'font-semibold tabular-nums text-amber-600' : 'font-semibold tabular-nums text-zinc-900'}>
        {value}
      </dd>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  reference,
  highlight = false,
}: {
  label: string;
  value: number;
  reference: number;
  highlight?: boolean;
}) {
  const ratio = reference > 0 ? Math.min(1, value / reference) : 0;
  const pct = reference > 0 ? Math.round(ratio * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className={highlight ? 'font-medium text-zinc-900' : 'text-zinc-600'}>{label}</span>
        <span className="tabular-nums">
          <span className={highlight ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}>
            {value.toLocaleString('fr-FR')}
          </span>
          <span className="ml-1.5 text-zinc-400">{pct}%</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={highlight ? 'h-full rounded-full bg-indigo-600' : 'h-full rounded-full bg-zinc-400'}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
