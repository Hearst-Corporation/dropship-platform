import Link from 'next/link';
import { ArrowUpRightIcon } from '@heroicons/react/20/solid';
import { getDbRead } from '@/lib/db';
import { StoreAvatar } from '@/components/ui';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatGrid, AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminCard, AdminCardHeader } from '@/components/admin/AdminCard';
import { FunnelChart, TrendLine } from '@/components/admin/AdminCharts';

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
interface TrendRow {
  label: string;
  revenue_cents: number;
  orders: number;
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

  const [stores, revenue, funnel, topStores, cost, trend] = await Promise.all([
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
    safeQuery<TrendRow[]>(
      async () => {
        const { rows } = await db.query<TrendRow>(
          `SELECT
             to_char(date_trunc('day', created_at), 'DD/MM') AS label,
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase'), 0)::bigint AS revenue_cents,
             COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS orders
           FROM dropship_funnel_events
           WHERE created_at > now() - interval '14 days'
           GROUP BY date_trunc('day', created_at)
           ORDER BY date_trunc('day', created_at)`,
        );
        return rows;
      },
      [],
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

      {/* Trend — revenue + orders over 14 days */}
      <AdminCard>
        <AdminCardHeader eyebrow="Tendance 14j" title="CA et commandes par jour" />
        <div className="px-5 py-4">
          {trend.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Pas encore de ventes sur les 14 derniers jours.</p>
          ) : (
            <TrendLine
              data={trend.map((t) => ({
                label: t.label,
                'CA (€)': Math.round(Number(t.revenue_cents) / 100),
                Commandes: Number(t.orders),
              }))}
              series={[
                { key: 'CA (€)', label: 'CA (€)', color: '#818cf8' },
                { key: 'Commandes', label: 'Commandes', color: '#34d399' },
              ]}
            />
          )}
        </div>
      </AdminCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top stores */}
        <AdminCard>
          <AdminCardHeader
            eyebrow="Performance 7j"
            title="Top stores"
            action={
              <Link href="/admin/stores" className="inline-flex items-center gap-0.5 text-xs font-medium text-indigo-400 hover:text-indigo-300">
                Tous <ArrowUpRightIcon className="size-3.5" aria-hidden />
              </Link>
            }
          />
          <div className="px-5 py-4">
            {topStores.length === 0 ? (
              <p className="py-2 text-sm text-gray-500">Aucun store actif avec des ventes 7j.</p>
            ) : (
              <ul role="list" className="divide-y divide-white/10">
                {topStores.map((s, idx) => (
                  <li key={s.slug}>
                    <Link href={`/admin/stores/${s.slug}`} className="flex items-center gap-3 py-2.5 hover:bg-white/5">
                      <span className="w-4 text-right text-xs tabular-nums text-gray-500">{idx + 1}</span>
                      <StoreAvatar slug={s.slug} name={s.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">{s.name}</div>
                        <div className="truncate text-xs tabular-nums text-gray-500">/shop/{s.slug}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={revenueClass(Number(s.revenue_cents))}>{eur(Number(s.revenue_cents))}</div>
                        <div className="text-xs tabular-nums text-gray-500">{s.orders} cmd</div>
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
            action={<span className="text-xs font-semibold tabular-nums text-white">{globalConv.toFixed(1)}%</span>}
          />
          <div className="px-5 py-4">
            <FunnelChart
              data={[
                { stage: 'View content', value: funnel.view_content },
                { stage: 'Add to cart', value: funnel.add_to_cart },
                { stage: 'Initiate checkout', value: funnel.initiate_checkout },
                { stage: 'Purchase', value: funnel.purchase },
              ]}
            />
          </div>
        </AdminCard>

        {/* Coût agent */}
        <AdminCard>
          <AdminCardHeader eyebrow="Coût Claude 30j" title="Observabilité agent" />
          <div className="space-y-4 px-5 py-4">
            <div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums text-white">
                {totalCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </div>
              <div className="mt-1 text-xs text-gray-500">Total des appels agent</div>
            </div>
            <dl className="space-y-2 text-sm">
              <StatRow label="Runs" value={cost.runs.toLocaleString('fr-FR')} />
              <StatRow label="Coût moyen / run" value={`${(avgPerRun * 1000).toFixed(3)} m€`} />
              <StatRow label="Taux d'erreur" value={`${errorRate.toFixed(1)}%`} warning={errorRate > 5} />
            </dl>
            <Link
              href="/admin/observability"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-white/5 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-white/10 hover:bg-white/10"
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
    ? 'text-sm font-semibold tabular-nums text-white'
    : 'text-sm font-semibold tabular-nums text-gray-500';
}

function StatRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-gray-400">{label}</dt>
      <dd className={warning ? 'font-semibold tabular-nums text-amber-400' : 'font-semibold tabular-nums text-white'}>
        {value}
      </dd>
    </div>
  );
}
