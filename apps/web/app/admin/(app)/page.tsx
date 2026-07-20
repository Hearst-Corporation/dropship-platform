import clsx from "clsx";
import { getDbRead } from "@/lib/db";
import { StoreAvatar } from "@/components/ui";
import { TextLink } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/table";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "@/components/ui/description-list";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminSparkline } from "@/components/admin/AdminSparkline";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminTimeframeSelector } from "@/components/admin/AdminTimeframeSelector";
import {
  BuildingStorefrontIcon,
  CubeIcon,
  CurrencyEuroIcon,
  FunnelIcon,
  ShoppingBagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { formatEurFromCents as eur, formatPercent } from "@/lib/format";
import { DashboardTrend, DashboardFunnel } from "./DashboardChartsLazy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Portfolio dashboard — aggregates KPIs across every store. All queries hit the
 * read replica and fail-soft individually (one slow source never blocks the page).
 * Data layer preserved verbatim from the pre-reset dashboard; UI rebuilt on the
 * admin foundation lib (page header / stat cards / sections / data table) plus
 * Recharts trend & funnel visuals.
 */
interface StoresRow {
  active: number;
  created_7d: number;
  prev_created_7d: number;
  total_products: number;
  products_7d: number;
  prev_products_7d: number;
}
interface RevenueRow {
  revenue_30d_cents: number;
  prev_revenue_30d_cents: number;
  revenue_7d_cents: number;
  prev_revenue_7d_cents: number;
  orders_30d: number;
  prev_orders_30d: number;
  orders_7d: number;
  prev_orders_7d: number;
  aov_30d_cents: number;
  prev_aov_30d_cents: number;
}
interface FunnelRow {
  view_content: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchase: number;
  prev_view_content: number;
  prev_purchase: number;
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
  /** UTC calendar day, 'YYYY-MM-DD' — matched against a UTC-computed key below. */
  day: string;
  revenue_cents: number;
  orders: number;
}

interface SafeQueryResult<T> {
  data: T;
  failed: boolean;
}

// Fails soft (returns the fallback so one slow/broken metric never blocks the
// whole dashboard) but keeps a `failed` flag alongside the data so the UI can
// still surface which metrics are showing a fallback vs. a genuine value.
async function safeQuery<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<SafeQueryResult<T>> {
  try {
    return { data: await fn(), failed: false };
  } catch (e) {
    console.error(
      "[dashboard] query failed:",
      e instanceof Error ? e.message : e,
    );
    return { data: fallback, failed: true };
  }
}

// Gap-fill the 14-day window: the SQL GROUP BY only returns days with at
// least one event, so missing days are re-injected at zero to keep the X
// axis regular. Matched on a UTC 'YYYY-MM-DD' key (see the SQL's `AT TIME
// ZONE 'UTC'` below) so the join can't drift from the app server's local
// timezone — only the final display label is formatted DD/MM.
function gapFillTrend(
  trend: TrendRow[],
): Array<{ label: string; ca: number; commandes: number }> {
  const byDay = new Map(trend.map((t) => [t.day, t]));
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000);
    const day = d.toISOString().slice(0, 10); // UTC 'YYYY-MM-DD'
    const [, month, date] = day.split("-");
    const row = byDay.get(day);
    return {
      label: `${date}/${month}`,
      ca: Number(row?.revenue_cents ?? 0) / 100,
      commandes: Number(row?.orders ?? 0),
    };
  });
}

function formatDelta(current: number, previous: number) {
  if (previous === 0) return undefined;
  const pct = ((current - previous) / previous) * 100;
  const positive = pct >= 0;
  const value = formatPercent(pct, { signed: true });
  return { value, positive };
}

export default async function PortfolioDashboard() {
  const db = getDbRead();

  const [
    storesResult,
    revenueResult,
    funnelResult,
    topStoresResult,
    costResult,
    trendResult,
  ] = await Promise.all([
    safeQuery<StoresRow>(
      async () => {
        const { rows } = await db.query<StoresRow>(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS created_7d,
             COUNT(*) FILTER (WHERE created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::int AS prev_created_7d,
             COALESCE(SUM(product_count) FILTER (WHERE status = 'active'), 0)::int AS total_products,
             COALESCE(SUM(product_count) FILTER (WHERE created_at > now() - interval '7 days'), 0)::int AS products_7d,
             COALESCE(SUM(product_count) FILTER (WHERE created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days'), 0)::int AS prev_products_7d
           FROM dropship_stores`,
        );
        return rows[0]!;
      },
      {
        active: 0,
        created_7d: 0,
        prev_created_7d: 0,
        total_products: 0,
        products_7d: 0,
        prev_products_7d: 0,
      },
    ),
    safeQuery<RevenueRow>(
      async () => {
        const { rows } = await db.query<RevenueRow>(
          `SELECT
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days'), 0)::bigint AS revenue_30d_cents,
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'), 0)::bigint AS prev_revenue_30d_cents,
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '7 days'), 0)::bigint AS revenue_7d_cents,
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days'), 0)::bigint AS prev_revenue_7d_cents,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days')::int AS orders_30d,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days')::int AS prev_orders_30d,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '7 days')::int AS orders_7d,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::int AS prev_orders_7d,
             COALESCE(AVG(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days'), 0)::bigint AS aov_30d_cents,
             COALESCE(AVG(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'), 0)::bigint AS prev_aov_30d_cents
           FROM dropship_funnel_events`,
        );
        return rows[0]!;
      },
      {
        revenue_30d_cents: 0,
        prev_revenue_30d_cents: 0,
        revenue_7d_cents: 0,
        prev_revenue_7d_cents: 0,
        orders_30d: 0,
        prev_orders_30d: 0,
        orders_7d: 0,
        prev_orders_7d: 0,
        aov_30d_cents: 0,
        prev_aov_30d_cents: 0,
      },
    ),
    safeQuery<FunnelRow>(
      async () => {
        const { rows } = await db.query<FunnelRow>(
          `SELECT
             COUNT(*) FILTER (WHERE event_name = 'view_content' AND created_at > now() - interval '30 days')::int AS view_content,
             COUNT(*) FILTER (WHERE event_name = 'add_to_cart' AND created_at > now() - interval '30 days')::int AS add_to_cart,
             COUNT(*) FILTER (WHERE event_name = 'initiate_checkout' AND created_at > now() - interval '30 days')::int AS initiate_checkout,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days')::int AS purchase,
             COUNT(*) FILTER (WHERE event_name = 'view_content' AND created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days')::int AS prev_view_content,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days')::int AS prev_purchase
           FROM dropship_funnel_events`,
        );
        return rows[0]!;
      },
      {
        view_content: 0,
        add_to_cart: 0,
        initiate_checkout: 0,
        purchase: 0,
        prev_view_content: 0,
        prev_purchase: 0,
      },
    ),
    safeQuery<TopStoreRow[]>(async () => {
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
    }, []),
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
      { total_cost_eur: "0", runs: 0, errors: 0, avg_cost_per_run: "0" },
    ),
    safeQuery<TrendRow[]>(async () => {
      const { rows } = await db.query<TrendRow>(
        `SELECT
             to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase'), 0)::bigint AS revenue_cents,
             COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS orders
           FROM dropship_funnel_events
           WHERE created_at > now() - interval '14 days'
           GROUP BY date_trunc('day', created_at AT TIME ZONE 'UTC')
           ORDER BY date_trunc('day', created_at AT TIME ZONE 'UTC')`,
      );
      return rows;
    }, []),
  ]);

  const stores = storesResult.data;
  const revenue = revenueResult.data;
  const funnel = funnelResult.data;
  const topStores = topStoresResult.data;
  const cost = costResult.data;
  const trend = trendResult.data;

  const failedMetrics = [
    storesResult.failed && "Stores",
    revenueResult.failed && "Revenus",
    funnelResult.failed && "Funnel",
    topStoresResult.failed && "Top stores",
    costResult.failed && "Coût agent",
    trendResult.failed && "Tendance",
  ].filter((v): v is string => Boolean(v));

  const revenue30dCents = Number(revenue.revenue_30d_cents);
  const revenue7dCents = Number(revenue.revenue_7d_cents);
  const aov30dCents = Number(revenue.aov_30d_cents);
  const totalCost = Number(cost.total_cost_eur || 0);
  const avgPerRun = Number(cost.avg_cost_per_run || 0);
  const errorRate = cost.runs ? (cost.errors / cost.runs) * 100 : 0;
  const globalConv =
    funnel.view_content > 0 ? (funnel.purchase / funnel.view_content) * 100 : 0;
  const prevGlobalConv =
    funnel.prev_view_content > 0
      ? (funnel.prev_purchase / funnel.prev_view_content) * 100
      : 0;

  // Serialize DB rows (bigint/text -> number) for the client chart wrappers,
  // with the 14-day window gap-filled so the X axis stays regular.
  const trendData = gapFillTrend(trend);

  const funnelSteps = [
    { label: "Vues produit", value: funnel.view_content },
    { label: "Ajouts panier", value: funnel.add_to_cart },
    { label: "Checkouts initiés", value: funnel.initiate_checkout },
    { label: "Achats", value: funnel.purchase },
  ];

  // The top-stores query LEFT JOINs every active store, so rows at 0 orders
  // come back too: only stores with at least one sale count as "top sellers".
  const sellers = topStores.filter((s) => Number(s.orders) > 0);
  const maxRevenue =
    sellers.length > 0
      ? Math.max(...sellers.map((s) => Number(s.revenue_cents)))
      : 0;

  const deltaRev30 = formatDelta(
    revenue30dCents,
    Number(revenue.prev_revenue_30d_cents),
  );

  return (
    <div className="space-y-8">
      {/* Hero Command Center */}
      <AdminPageHeader
        title="Vue d'ensemble"
        subtitle="KPIs agrégés sur l'ensemble des stores actifs."
        actions={
          <>
            <Button href="/admin/stores/new" color="indigo">
              Nouveau store
            </Button>
            <Button href="/admin/orders" outline>
              Commandes
            </Button>
          </>
        }
      />

      {failedMetrics.length > 0 && (
        <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/10 p-4">
          <ExclamationTriangleIcon className="size-5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200">
            <span className="font-bold">
              Certaines données n&apos;ont pas pu être chargées
            </span>{" "}
            ({failedMetrics.join(", ")}) — les valeurs affichées pour ces
            métriques sont provisoires. Voir les logs serveur pour le détail.
          </p>
        </div>
      )}

      <AdminSection flush>
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="flex flex-col justify-center border-b border-admin-border bg-admin-surface-panel p-6 lg:border-b-0 lg:border-r lg:p-8">
            <p className="text-admin-kicker font-bold uppercase tracking-[0.15em] text-zinc-400">
              Performance
            </p>
            <h2 className="mt-2 text-sm font-medium text-white">
              Chiffre d&apos;affaires (30j)
            </h2>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-5xl font-bold tracking-tight text-white tabular-nums text-white">
                {eur(revenue30dCents)}
              </span>
              {deltaRev30 && (
                <span
                  className={`text-sm font-bold ${deltaRev30.positive ? "text-indigo-400" : "text-zinc-400"}`}
                >
                  {deltaRev30.value}
                </span>
              )}
            </div>
            <p className="mt-6 text-sm text-zinc-400">
              {revenue.orders_30d.toLocaleString("fr-FR")} commandes au total.
              Panier moyen de{" "}
              <span className="font-semibold text-white">
                {eur(aov30dCents)}
              </span>
              .
            </p>
          </div>
          <div className="p-6 bg-admin-surface-panel lg:col-span-2 lg:p-8">
            <div className="mb-8 flex items-center justify-between gap-3">
              <h3 className="text-admin-kicker font-bold uppercase tracking-[0.15em] text-zinc-400">
                Tendance
              </h3>
              <AdminTimeframeSelector />
            </div>
            <DashboardTrend data={trendData} />
          </div>
        </div>
      </AdminSection>

      {/* KPIs */}
      <AdminStatsGrid cols={4}>
        <AdminStatCard
          label="Stores actifs"
          value={stores.active.toLocaleString("fr-FR")}
          delta={formatDelta(stores.created_7d, stores.prev_created_7d)}
          hint={`+${stores.created_7d} sur 7j`}
          icon={BuildingStorefrontIcon}
        />
        <AdminStatCard
          label="Produits"
          value={stores.total_products.toLocaleString("fr-FR")}
          delta={formatDelta(stores.products_7d, stores.prev_products_7d)}
          hint={`+${stores.products_7d} sur 7j`}
          icon={CubeIcon}
        />
        <AdminStatCard
          label="CA 7j"
          value={eur(revenue7dCents)}
          delta={formatDelta(
            revenue7dCents,
            Number(revenue.prev_revenue_7d_cents),
          )}
          hint={`${revenue.orders_7d.toLocaleString("fr-FR")} commandes`}
          icon={CurrencyEuroIcon}
          chart={
            <AdminSparkline data={trendData.map((d) => d.ca)} color="white" />
          }
        />
        <AdminStatCard
          label="Conversion globale 30j"
          value={formatPercent(globalConv)}
          delta={formatDelta(globalConv, prevGlobalConv)}
          hint={`${funnel.purchase.toLocaleString("fr-FR")} achats`}
          icon={FunnelIcon}
          chart={
            <AdminSparkline
              data={funnelSteps.map((d) => d.value)}
              color="white"
            />
          }
        />
      </AdminStatsGrid>

      {/* Deux colonnes : funnel + top stores */}
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <AdminSection
          title="Funnel 30j"
          description="Volume par étape du parcours d'achat."
          actions={
            <Badge color="indigo">{formatPercent(globalConv)} conv.</Badge>
          }
        >
          <DashboardFunnel steps={funnelSteps} />
        </AdminSection>

        <AdminSection
          title="Top stores · 7j"
          description="Stores actifs classés par CA sur 7 jours."
          actions={<TextLink href="/admin/stores">Tous les stores</TextLink>}
          flush
        >
          {sellers.length === 0 ? (
            <AdminEmptyState
              icon={BuildingStorefrontIcon}
              title="Aucune vente sur 7j"
              description="Aucun store actif n'a enregistré de commande sur les 7 derniers jours."
            />
          ) : (
            <AdminDataTable fixedLayout>
              <Table dense bleed clip>
                <colgroup>
                  <col style={{ width: "2.5rem" }} />
                  <col />
                  <col style={{ width: "6.5rem" }} />
                  <col style={{ width: "4.5rem" }} />
                </colgroup>
                <TableHead>
                  <TableRow>
                    <TableHeader className="w-10 text-right hidden sm:table-cell">
                      #
                    </TableHeader>
                    <TableHeader>Store</TableHeader>
                    <TableHeader className="text-right">CA 7j</TableHeader>
                    <TableHeader className="text-right hidden sm:table-cell">
                      Cmd
                    </TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sellers.map((s, idx) => {
                    const rev = Number(s.revenue_cents);
                    return (
                      <TableRow key={s.slug} href={`/admin/stores/${s.slug}`}>
                        <TableCell className="text-right text-xs tabular-nums text-zinc-400 hidden sm:table-cell">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="min-w-0">
                          <div className="flex items-center gap-4">
                            <StoreAvatar
                              slug={s.slug}
                              name={s.name}
                              size={32}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-bold text-white">
                                {s.name}
                              </div>
                              <div className="truncate text-admin-kicker tracking-widest uppercase tabular-nums text-zinc-500 text-zinc-400">
                                /shop/{s.slug}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-white">
                          {eur(rev)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-zinc-400 hidden sm:table-cell">
                          {s.orders.toLocaleString("fr-FR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AdminDataTable>
          )}
        </AdminSection>
      </div>

      {/* Observabilité agent + alertes opérationnelles */}
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <AdminSection
          title="Coût IA 30j"
          description="Observabilité des appels agent sur 30 jours."
          actions={
            <Button href="/admin/observability" outline>
              Détail par étape
            </Button>
          }
          flush
        >
          <DescriptionList className="px-5 pb-4 sm:px-6">
            <DescriptionTerm>Total des appels agent</DescriptionTerm>
            <DescriptionDetails className="text-right tabular-nums">
              {totalCost.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              €
            </DescriptionDetails>
            <DescriptionTerm>Runs</DescriptionTerm>
            <DescriptionDetails className="text-right tabular-nums">
              {cost.runs.toLocaleString("fr-FR")}
            </DescriptionDetails>
            <DescriptionTerm>Coût moyen / run</DescriptionTerm>
            <DescriptionDetails className="text-right tabular-nums">
              {avgPerRun.toLocaleString("fr-FR", {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
              })}{" "}
              €
            </DescriptionDetails>
            <DescriptionTerm>Taux d&apos;erreur</DescriptionTerm>
            <DescriptionDetails className="text-right tabular-nums">
              {errorRate > 5 ? (
                <Badge color="zinc">{formatPercent(errorRate)} · élevé</Badge>
              ) : (
                <span>{formatPercent(errorRate)}</span>
              )}
            </DescriptionDetails>
          </DescriptionList>
        </AdminSection>

        <AdminSection
          title="Alertes opérationnelles"
          description="Signaux nécessitant une attention immédiate."
        >
          {errorRate > 5 ? (
            <div className="flex items-start gap-4 border border-admin-border bg-admin-surface-panel p-5">
              <ExclamationTriangleIcon className="size-5 shrink-0 text-zinc-400 text-zinc-500" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">
                  Taux d&apos;erreur agent élevé
                </p>
                <p className="mt-1 text-xs/5 text-zinc-400">
                  {cost.errors.toLocaleString("fr-FR")} erreurs sur{" "}
                  {cost.runs.toLocaleString("fr-FR")} runs (
                  {formatPercent(errorRate)}) sur les 30 derniers jours.
                </p>
                <TextLink
                  href="/admin/observability"
                  className="mt-2 inline-block text-admin-kicker font-bold uppercase tracking-widest text-indigo-400"
                >
                  Voir l&apos;observabilité
                </TextLink>
              </div>
            </div>
          ) : (
            <AdminEmptyState
              icon={CheckCircleIcon}
              title="Aucune alerte"
              description="Le taux d'erreur agent est nominal sur les 30 derniers jours."
            />
          )}
        </AdminSection>
      </div>
    </div>
  );
}
