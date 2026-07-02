import { notFound } from "next/navigation";
import { getDbRead } from "@/lib/db";
import { resolveStoreId } from "@/lib/resolve-store";
import { formatMoney } from "@/lib/medusa-store";
import { Heading } from "@/components/catalyst/heading";
import { Text, TextLink, Strong } from "@/components/catalyst/text";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminTruncatedText } from "@/components/admin/AdminTruncatedText";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { Button } from "@/components/catalyst/button";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/catalyst/table";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "@/components/catalyst/description-list";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}

interface AcquisitionRow {
  source: string;
  campaign: string;
  visits: number;
  adds_to_cart: number;
  initiate_checkouts: number;
  purchases: number;
  revenue_minor: number;
}

interface FunnelRow {
  event_name: string;
  sessions: number;
  events: number;
  revenue_minor: number;
}

const RANGE_TO_INTERVAL: Record<string, { label: string; sql: string }> = {
  "7d": { label: "7 jours", sql: "interval '7 days'" },
  "30d": { label: "30 jours", sql: "interval '30 days'" },
  "90d": { label: "90 jours", sql: "interval '90 days'" },
};

const FUNNEL_ORDER = ["add_to_cart", "initiate_checkout", "purchase"] as const;
const FUNNEL_LABEL: Record<string, string> = {
  add_to_cart: "Ajouts au panier",
  initiate_checkout: "Checkouts initiés",
  purchase: "Achats",
};

export default async function StoreAnalyticsPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { range = "30d" } = await searchParams;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  const storeRes = await db.query<{
    slug: string;
    name: string;
    clarity_id: string | null;
    ga4_measurement_id: string | null;
    meta_pixel_id: string | null;
    tiktok_pixel_id: string | null;
  }>(
    `SELECT slug, name, clarity_id, ga4_measurement_id, meta_pixel_id, tiktok_pixel_id
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const cfg = RANGE_TO_INTERVAL[range] ?? RANGE_TO_INTERVAL["30d"]!;
  const intervalSql = cfg.sql;

  // UA (acquisition) et UX (funnel) ne dépendent que de store.slug — on les
  // lance en parallèle. Fail-soft : une erreur DB ne doit pas afficher l'UI
  // d'erreur dans l'admin, on retombe sur des résultats vides.
  let acquisitionRows: AcquisitionRow[] = [];
  let funnelRows: FunnelRow[] = [];
  let dataError = false;
  try {
    const [acquisitionRes, funnelRes] = await Promise.all([
      // ============ UA — Acquisition ============
      db.query<AcquisitionRow>(
        `SELECT
           COALESCE(NULLIF(utm_source, ''), '(direct)') AS source,
           COALESCE(NULLIF(utm_campaign, ''), '(none)') AS campaign,
           COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'add_to_cart')::int AS visits,
           COUNT(*) FILTER (WHERE event_name = 'add_to_cart')::int AS adds_to_cart,
           COUNT(*) FILTER (WHERE event_name = 'initiate_checkout')::int AS initiate_checkouts,
           COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS purchases,
           COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase'), 0)::int AS revenue_minor
         FROM dropship_funnel_events
         WHERE store_slug = $1 AND created_at >= now() - ${intervalSql}
         GROUP BY source, campaign
         ORDER BY revenue_minor DESC, purchases DESC, adds_to_cart DESC
         LIMIT 50`,
        [store.slug],
      ),
      // ============ UX — Funnel ============
      db.query<FunnelRow>(
        `SELECT
           event_name,
           COUNT(DISTINCT session_id)::int AS sessions,
           COUNT(*)::int AS events,
           COALESCE(SUM(value_minor), 0)::int AS revenue_minor
         FROM dropship_funnel_events
         WHERE store_slug = $1 AND created_at >= now() - ${intervalSql}
           AND event_name = ANY($2::text[])
         GROUP BY event_name`,
        [store.slug, [...FUNNEL_ORDER]],
      ),
    ]);
    acquisitionRows = acquisitionRes.rows;
    funnelRows = funnelRes.rows;
  } catch (err) {
    console.error(
      "[store-analytics] requêtes funnel/acquisition échouées:",
      err,
    );
    dataError = true;
  }
  const funnelByName = new Map(funnelRows.map((r) => [r.event_name, r]));

  // ============ Aggregates ============
  const totalRevenue = acquisitionRows.reduce(
    (acc, r) => acc + (r.revenue_minor || 0),
    0,
  );
  const totalPurchases = acquisitionRows.reduce(
    (acc, r) => acc + (r.purchases || 0),
    0,
  );
  const totalAdds = acquisitionRows.reduce(
    (acc, r) => acc + (r.adds_to_cart || 0),
    0,
  );
  const aov = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;
  const cartToPurchase = totalAdds > 0 ? (totalPurchases / totalAdds) * 100 : 0;

  const stats: { label: string; value: string; hint?: string }[] = [
    {
      label: "Revenu",
      value: totalRevenue > 0 ? formatMoney(totalRevenue / 100, "eur") : "—",
    },
    { label: "Commandes", value: String(totalPurchases) },
    {
      label: "Panier moyen",
      value: aov > 0 ? formatMoney(aov / 100, "eur") : "—",
    },
    {
      label: "Conv. cart → purchase",
      value: totalAdds > 0 ? `${cartToPurchase.toFixed(1)} %` : "—",
      hint: cartToPurchase >= 30 ? "Au-dessus du seuil" : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Text className="text-xs/5 font-medium uppercase tracking-wider">
            Analytics · {store.name}
          </Text>
          <Heading>Acquisition & comportement</Heading>
          <Text>Période : {cfg.label}.</Text>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(RANGE_TO_INTERVAL).map(([key, c]) =>
            key === range ? (
              <Button
                key={key}
                href={`?range=${key}`}
                color="indigo"
                aria-current="true"
              >
                {c.label}
              </Button>
            ) : (
              <Button key={key} href={`?range=${key}`} plain>
                {c.label}
              </Button>
            ),
          )}
        </div>
      </div>

      {dataError && (
        <div className="rounded-md border border-admin-border bg-admin-surface-panel px-4 py-3 text-sm text-white">
          Données temporairement indisponibles. Réessaie dans un instant.
        </div>
      )}

      <AdminSection title="Indicateurs clés">
        <AdminStatsGrid cols={4}>
          {stats.map((s) => (
            <AdminStatCard
              key={s.label}
              label={s.label}
              value={s.value}
              hint={s.hint}
            />
          ))}
        </AdminStatsGrid>
      </AdminSection>

      <AdminSection
        title="Comportement (UX)"
        description="Funnel des sessions uniques sur les events serveur. Les session_id se persistent 30 jours."
      >
        <DescriptionList>
          {FUNNEL_ORDER.map((name) => (
            <DescriptionListPair
              key={name}
              term={FUNNEL_LABEL[name] ?? name}
              detail={funnelByName.get(name)?.sessions ?? 0}
            />
          ))}
        </DescriptionList>
        {store.clarity_id && (
          <Text className="mt-4 text-xs/5">
            Pour les replays vidéo et les heatmaps, ouvre le projet sur{" "}
            <TextLink
              href={`https://clarity.microsoft.com/projects/view/${store.clarity_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Microsoft Clarity ↗
            </TextLink>
            .
          </Text>
        )}
      </AdminSection>

      <AdminSection
        title="Acquisition (UA)"
        description="Décomposition par utm_source / utm_campaign. Les visiteurs sans UTM sont regroupés sous (direct)."
        flush={acquisitionRows.length > 0}
      >
        {acquisitionRows.length === 0 ? (
          <AdminEmptyState
            title="Aucun évènement sur cette période"
            description="Les sessions avec UTM apparaîtront ici dès qu'une campagne enverra du trafic."
          />
        ) : (
          <AdminDataTable fixedLayout>
            <Table dense bleed clip>
              <colgroup>
                <col style={{ width: "6rem" }} />
                <col />
                <col style={{ width: "4.5rem" }} />
                <col style={{ width: "4rem" }} />
                <col style={{ width: "5rem" }} />
                <col style={{ width: "4.5rem" }} />
                <col style={{ width: "6rem" }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  <TableHeader className="whitespace-nowrap">Source</TableHeader>
                  <TableHeader>Campagne</TableHeader>
                  <TableHeader className="whitespace-nowrap text-right hidden sm:table-cell">
                    Sessions
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right hidden md:table-cell">
                    Cart
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right hidden lg:table-cell">
                    Checkout
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right">
                    Achats
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right hidden sm:table-cell">
                    Revenu
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {acquisitionRows.map((r, i) => {
                  const conv =
                    r.adds_to_cart > 0 ? (r.purchases / r.adds_to_cart) * 100 : 0;
                  return (
                    <TableRow key={i}>
                      <TableCell className="min-w-0">
                        <Strong className="truncate">{r.source}</Strong>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <AdminTruncatedText
                          className="text-zinc-500"
                          title={r.campaign}
                        >
                          {r.campaign}
                        </AdminTruncatedText>
                      </TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">
                      {r.visits}
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {r.adds_to_cart}
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden lg:table-cell">
                      {r.initiate_checkouts}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Strong>{r.purchases}</Strong>
                      {r.adds_to_cart > 0 && (
                        <span className="ml-1.5 text-xs text-zinc-500">
                          {conv.toFixed(0)} %
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">
                      <Strong>
                        {r.revenue_minor > 0
                          ? formatMoney(r.revenue_minor / 100, "eur")
                          : "—"}
                      </Strong>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </AdminDataTable>
        )}
      </AdminSection>

      <AdminSection
        title="Plomberie connectée"
        description="Pixels et IDs analytics configurés pour ce store."
      >
        <div className="flex flex-wrap gap-3">
          <ConnState label="GA4" set={!!store.ga4_measurement_id} />
          <ConnState label="Meta Pixel" set={!!store.meta_pixel_id} />
          <ConnState label="TikTok Pixel" set={!!store.tiktok_pixel_id} />
          <ConnState label="Clarity" set={!!store.clarity_id} />
        </div>
        <Text className="mt-4 text-xs/5">
          IDs vides ?{" "}
          <TextLink href={`/admin/stores/${id}/settings`}>
            Configure-les dans les Réglages
          </TextLink>
        </Text>
      </AdminSection>
    </div>
  );
}

function DescriptionListPair({
  term,
  detail,
}: {
  term: string;
  detail: number;
}) {
  return (
    <>
      <DescriptionTerm>{term}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">{detail}</DescriptionDetails>
    </>
  );
}

function ConnState({ label, set }: { label: string; set: boolean }) {
  return (
    <AdminBadge status={set ? "connecté" : "inactif"}>
      {label} · {set ? "connecté" : "inactif"}
    </AdminBadge>
  );
}
