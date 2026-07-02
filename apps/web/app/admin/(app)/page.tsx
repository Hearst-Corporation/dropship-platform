import { getDbRead } from '@/lib/db';
import { StoreAvatar } from '@/components/ui';
import { TextLink } from '@/components/catalyst/text';
import { Badge } from '@/components/catalyst/badge';
import { Button } from '@/components/catalyst/button';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/catalyst/table';
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from '@/components/catalyst/description-list';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSection } from '@/components/admin/AdminSection';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import {
  BuildingStorefrontIcon,
  CubeIcon,
  CurrencyEuroIcon,
  FunnelIcon,
  ShoppingBagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { DashboardTrend, DashboardFunnel } from './DashboardCharts';

export const dynamic = 'force-dynamic';
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
  /** UTC calendar day, 'YYYY-MM-DD' — matched against a UTC-computed key below. */
  day: string;
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

// Gap-fill the 14-day window: the SQL GROUP BY only returns days with at
// least one event, so missing days are re-injected at zero to keep the X
// axis regular. Matched on a UTC 'YYYY-MM-DD' key (see the SQL's `AT TIME
// ZONE 'UTC'` below) so the join can't drift from the app server's local
// timezone — only the final display label is formatted DD/MM.
function gapFillTrend(trend: TrendRow[]): Array<{ label: string; ca: number; commandes: number }> {
  const byDay = new Map(trend.map((t) => [t.day, t]));
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000);
    const day = d.toISOString().slice(0, 10); // UTC 'YYYY-MM-DD'
    const [, month, date] = day.split('-');
    const row = byDay.get(day);
    return {
      label: `${date}/${month}`,
      ca: Number(row?.revenue_cents ?? 0) / 100,
      commandes: Number(row?.orders ?? 0),
    };
  });
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
             to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase'), 0)::bigint AS revenue_cents,
             COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS orders
           FROM dropship_funnel_events
           WHERE created_at > now() - interval '14 days'
           GROUP BY date_trunc('day', created_at AT TIME ZONE 'UTC')
           ORDER BY date_trunc('day', created_at AT TIME ZONE 'UTC')`,
        );
        return rows;
      },
      [],
    ),
  ]);

  const revenue30dCents = Number(revenue.revenue_30d_cents);
  const revenue7dCents = Number(revenue.revenue_7d_cents);
  const aov30dCents = Number(revenue.aov_30d_cents);
  const totalCost = Number(cost.total_cost_eur || 0);
  const avgPerRun = Number(cost.avg_cost_per_run || 0);
  const errorRate = cost.runs ? (cost.errors / cost.runs) * 100 : 0;
  const globalConv = funnel.view_content > 0 ? (funnel.purchase / funnel.view_content) * 100 : 0;

  // Serialize DB rows (bigint/text -> number) for the client chart wrappers,
  // with the 14-day window gap-filled so the X axis stays regular.
  const trendData = gapFillTrend(trend);

  const funnelSteps = [
    { label: 'Vues produit', value: funnel.view_content },
    { label: 'Ajouts panier', value: funnel.add_to_cart },
    { label: 'Checkouts initiés', value: funnel.initiate_checkout },
    { label: 'Achats', value: funnel.purchase },
  ];

  // The top-stores query LEFT JOINs every active store, so rows at 0 orders
  // come back too: only stores with at least one sale count as "top sellers".
  const sellers = topStores.filter((s) => Number(s.orders) > 0);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Vue d'ensemble"
        subtitle="KPIs agrégés sur l'ensemble des stores actifs."
      />

      {/* KPIs */}
      <AdminStatsGrid cols={3}>
        <AdminStatCard
          label="Stores actifs"
          value={stores.active.toLocaleString('fr-FR')}
          hint={`+${stores.created_7d} sur 7j`}
          icon={BuildingStorefrontIcon}
        />
        <AdminStatCard
          label="Produits"
          value={stores.total_products.toLocaleString('fr-FR')}
          hint={`+${stores.products_7d} sur 7j`}
          icon={CubeIcon}
        />
        <AdminStatCard
          label="CA 30j"
          value={eur(revenue30dCents)}
          hint={`${revenue.orders_30d.toLocaleString('fr-FR')} commandes`}
          icon={CurrencyEuroIcon}
        />
        <AdminStatCard
          label="CA 7j"
          value={eur(revenue7dCents)}
          hint={`${revenue.orders_7d.toLocaleString('fr-FR')} commandes`}
          icon={CurrencyEuroIcon}
        />
        <AdminStatCard
          label="Panier moyen 30j"
          value={eur(aov30dCents)}
          hint="Sur commandes payées"
          icon={ShoppingBagIcon}
        />
        <AdminStatCard
          label="Conversion globale 30j"
          value={`${globalConv.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`}
          hint={`${funnel.purchase.toLocaleString('fr-FR')} achats / ${funnel.view_content.toLocaleString('fr-FR')} vues`}
          icon={FunnelIcon}
        />
      </AdminStatsGrid>

      {/* Trend — CA & commandes sur 14 jours */}
      <AdminSection
        title="Tendance 14j"
        description="CA (€, axe gauche) et commandes (axe droit) par jour sur les 14 derniers jours."
      >
        <DashboardTrend data={trendData} />
      </AdminSection>

      {/* Deux colonnes : funnel + top stores */}
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <AdminSection
          title="Funnel 30j"
          description="Volume par étape du parcours d'achat."
          actions={
            <Badge color="indigo">
              {globalConv.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} % conv.
            </Badge>
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
            <AdminDataTable minWidth="min-w-[32rem]" bare>
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader className="w-10 text-right">#</TableHeader>
                    <TableHeader>Store</TableHeader>
                    <TableHeader className="text-right">CA 7j</TableHeader>
                    <TableHeader className="text-right">Cmd</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sellers.map((s, idx) => (
                    <TableRow key={s.slug} href={`/admin/stores/${s.slug}`}>
                      <TableCell className="text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <StoreAvatar slug={s.slug} name={s.name} size={28} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{s.name}</div>
                            <div className="truncate text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                              /shop/{s.slug}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{eur(Number(s.revenue_cents))}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.orders.toLocaleString('fr-FR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminDataTable>
          )}
        </AdminSection>
      </div>

      {/* Observabilité agent + alertes opérationnelles */}
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <AdminSection
          title="Coût Claude 30j"
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
              {totalCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </DescriptionDetails>
            <DescriptionTerm>Runs</DescriptionTerm>
            <DescriptionDetails className="text-right tabular-nums">
              {cost.runs.toLocaleString('fr-FR')}
            </DescriptionDetails>
            <DescriptionTerm>Coût moyen / run</DescriptionTerm>
            <DescriptionDetails className="text-right tabular-nums">
              {avgPerRun.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €
            </DescriptionDetails>
            <DescriptionTerm>Taux d&apos;erreur</DescriptionTerm>
            <DescriptionDetails className="text-right tabular-nums">
              {errorRate > 5 ? (
                <Badge color="zinc">
                  {errorRate.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} % · élevé
                </Badge>
              ) : (
                <span>
                  {errorRate.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
                </span>
              )}
            </DescriptionDetails>
          </DescriptionList>
        </AdminSection>

        <AdminSection
          title="Alertes opérationnelles"
          description="Signaux nécessitant une attention immédiate."
        >
          {errorRate > 5 ? (
            <div className="flex items-start gap-3 rounded-lg border border-zinc-950/10 bg-zinc-950/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
              <ExclamationTriangleIcon className="size-5 shrink-0 text-zinc-400 dark:text-zinc-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-950 dark:text-white">
                  Taux d&apos;erreur agent élevé
                </p>
                <p className="mt-0.5 text-xs/5 text-zinc-500 dark:text-zinc-400">
                  {cost.errors.toLocaleString('fr-FR')} erreurs sur {cost.runs.toLocaleString('fr-FR')} runs (
                  {errorRate.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %) sur les
                  30 derniers jours.
                </p>
                <TextLink href="/admin/observability" className="mt-1 inline-block text-xs">
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
