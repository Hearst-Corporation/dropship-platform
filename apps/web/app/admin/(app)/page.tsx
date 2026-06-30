import { getDbRead } from '@/lib/db';
import { StoreAvatar } from '@/components/ui';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text, TextLink } from '@/components/catalyst/text';
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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Portfolio dashboard — aggregates KPIs across every store. All queries hit the
 * read replica and fail-soft individually (one slow source never blocks the page).
 * Data layer preserved verbatim from the pre-reset dashboard; UI rebuilt on
 * Catalyst (heading / surfaces / table / description-list). No charts.
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

  const funnelStages: { stage: string; value: number }[] = [
    { stage: 'View content', value: funnel.view_content },
    { stage: 'Add to cart', value: funnel.add_to_cart },
    { stage: 'Initiate checkout', value: funnel.initiate_checkout },
    { stage: 'Purchase', value: funnel.purchase },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading>Vue d&apos;ensemble</Heading>
          <Text>KPIs agrégés sur tous les stores actifs. Cliquez sur un bloc pour drill down.</Text>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatSurface label="Stores actifs" value={stores.active.toLocaleString('fr-FR')} hint={`+${stores.created_7d} sur 7j`} href="/admin/stores" />
        <StatSurface label="Produits" value={stores.total_products.toLocaleString('fr-FR')} hint={`+${stores.products_7d} sur 7j`} href="/admin/catalog" />
        <StatSurface label="CA 30j" value={eur(revenue30dCents)} hint={`${revenue.orders_30d} commandes`} />
        <StatSurface label="CA 7j" value={eur(revenue7dCents)} hint={`${revenue.orders_7d} commandes`} />
      </div>

      {/* Trend — revenue + orders over 14 days */}
      <Surface>
        <Subheading>Tendance 14j — CA et commandes par jour</Subheading>
        <div className="mt-4">
          {trend.length === 0 ? (
            <Text>Pas encore de ventes sur les 14 derniers jours.</Text>
          ) : (
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Jour</TableHeader>
                  <TableHeader className="text-right">CA</TableHeader>
                  <TableHeader className="text-right">Commandes</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {trend.map((t) => (
                  <TableRow key={t.label}>
                    <TableCell className="tabular-nums">{t.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(Number(t.revenue_cents))}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(t.orders)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top stores */}
        <Surface>
          <div className="flex items-center justify-between gap-2">
            <Subheading>Top stores — 7j</Subheading>
            <TextLink href="/admin/stores">Tous</TextLink>
          </div>
          <div className="mt-4">
            {topStores.length === 0 ? (
              <Text>Aucun store actif avec des ventes 7j.</Text>
            ) : (
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>Store</TableHeader>
                    <TableHeader className="text-right">CA</TableHeader>
                    <TableHeader className="text-right">Cmd</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topStores.map((s, idx) => (
                    <TableRow key={s.slug} href={`/admin/stores/${s.slug}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="w-4 text-right text-xs tabular-nums text-zinc-500">{idx + 1}</span>
                          <StoreAvatar slug={s.slug} name={s.name} size={28} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{s.name}</div>
                            <div className="truncate text-xs tabular-nums text-zinc-500">/shop/{s.slug}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{eur(Number(s.revenue_cents))}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.orders}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Surface>

        {/* Funnel */}
        <Surface>
          <div className="flex items-center justify-between gap-2">
            <Subheading>Funnel 30j — Conversion globale</Subheading>
            <Badge color="indigo">{globalConv.toFixed(1)}%</Badge>
          </div>
          <DescriptionList className="mt-4">
            {funnelStages.map((s) => (
              <div key={s.stage} className="contents">
                <DescriptionTerm>{s.stage}</DescriptionTerm>
                <DescriptionDetails className="tabular-nums">{s.value.toLocaleString('fr-FR')}</DescriptionDetails>
              </div>
            ))}
          </DescriptionList>
        </Surface>

        {/* Coût agent */}
        <Surface>
          <Subheading>Coût Claude 30j — Observabilité agent</Subheading>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums">
                {totalCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </div>
              <Text>Total des appels agent</Text>
            </div>
            <DescriptionList>
              <DescriptionTerm>Runs</DescriptionTerm>
              <DescriptionDetails className="tabular-nums">{cost.runs.toLocaleString('fr-FR')}</DescriptionDetails>
              <DescriptionTerm>Coût moyen / run</DescriptionTerm>
              <DescriptionDetails className="tabular-nums">{(avgPerRun * 1000).toFixed(3)} m€</DescriptionDetails>
              <DescriptionTerm>Taux d&apos;erreur</DescriptionTerm>
              <DescriptionDetails className="tabular-nums">
                {errorRate > 5 ? (
                  <Badge color="amber">{errorRate.toFixed(1)}%</Badge>
                ) : (
                  <span>{errorRate.toFixed(1)}%</span>
                )}
              </DescriptionDetails>
            </DescriptionList>
            <Button href="/admin/observability" outline className="w-full">
              Détail par step
            </Button>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      {children}
    </div>
  );
}

function StatSurface({ label, value, hint, href }: { label: string; value: string; hint: string; href?: string }) {
  const body = (
    <>
      <Text>{label}</Text>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-xs tabular-nums text-zinc-500">{hint}</div>
    </>
  );
  if (href) {
    return (
      <TextLink href={href} className="block rounded-lg bg-white p-6 no-underline ring-1 ring-zinc-950/5 hover:ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10 dark:hover:ring-white/20">
        {body}
      </TextLink>
    );
  }
  return <Surface>{body}</Surface>;
}
