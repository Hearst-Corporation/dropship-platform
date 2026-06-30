import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { formatMoney } from '@/lib/medusa-store';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatGrid, AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminCard, AdminCardHeader } from '@/components/admin/AdminCard';
import { FunnelChart } from '@/components/admin/AdminCharts';

export const dynamic = 'force-dynamic';

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
  '7d': { label: '7 jours', sql: "interval '7 days'" },
  '30d': { label: '30 jours', sql: "interval '30 days'" },
  '90d': { label: '90 jours', sql: "interval '90 days'" },
};

const FUNNEL_ORDER = ['add_to_cart', 'initiate_checkout', 'purchase'] as const;
const FUNNEL_LABEL: Record<string, string> = {
  add_to_cart: 'Ajouts au panier',
  initiate_checkout: 'Checkouts initiés',
  purchase: 'Achats',
};

export default async function StoreAnalyticsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { range = '30d' } = await searchParams;
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

  const cfg = RANGE_TO_INTERVAL[range] ?? RANGE_TO_INTERVAL['30d']!;
  const intervalSql = cfg.sql;

  // ============ UA — Acquisition ============
  const acquisitionRes = await db.query<AcquisitionRow>(
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
  );

  // ============ UX — Funnel ============
  const funnelRes = await db.query<FunnelRow>(
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
  );
  const funnelByName = new Map(funnelRes.rows.map((r) => [r.event_name, r]));

  // ============ Aggregates ============
  const totalRevenue = acquisitionRes.rows.reduce((acc, r) => acc + (r.revenue_minor || 0), 0);
  const totalPurchases = acquisitionRes.rows.reduce((acc, r) => acc + (r.purchases || 0), 0);
  const totalAdds = acquisitionRes.rows.reduce((acc, r) => acc + (r.adds_to_cart || 0), 0);
  const aov = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;
  const cartToPurchase = totalAdds > 0 ? (totalPurchases / totalAdds) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <AdminPageHeader
        eyebrow={`Analytics · ${store.name}`}
        title={
          <span>
            Acquisition <em className="font-normal not-italic text-gray-500">&amp; comportement</em>
          </span>
        }
        description={`Période : ${cfg.label}.`}
        actions={
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-gray-800/50 p-1">
            {Object.entries(RANGE_TO_INTERVAL).map(([key, c]) => (
              <Link
                key={key}
                href={`?range=${key}`}
                className={
                  'rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ' +
                  (key === range ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white')
                }
              >
                {c.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* Aggregate KPIs */}
      <AdminStatGrid>
        <AdminStatCard
          label="Revenu"
          value={totalRevenue > 0 ? formatMoney(totalRevenue / 100, 'eur') : '—'}
        />
        <AdminStatCard label="Commandes" value={String(totalPurchases)} />
        <AdminStatCard
          label="Panier moyen"
          value={aov > 0 ? formatMoney(aov / 100, 'eur') : '—'}
        />
        <AdminStatCard
          label="Conv. cart → purchase"
          value={totalAdds > 0 ? `${cartToPurchase.toFixed(1)} %` : '—'}
          hint={cartToPurchase >= 30 ? 'Au-dessus du seuil' : undefined}
        />
      </AdminStatGrid>

      {/* UX — Funnel */}
      <AdminCard>
        <AdminCardHeader
          title={
            <span>
              Comportement <em className="font-normal not-italic text-gray-500">(UX)</em>
            </span>
          }
        />
        <div className="px-5 pt-4">
          <p className="text-xs text-gray-500">
            Funnel des sessions uniques sur les events serveur. Les session_id se persistent 30 jours.
          </p>
        </div>
        <div className="px-5 py-5">
          <FunnelChart
            height={220}
            data={FUNNEL_ORDER.map((name) => ({
              stage: FUNNEL_LABEL[name],
              value: funnelByName.get(name)?.sessions ?? 0,
            }))}
          />
        </div>
        {store.clarity_id && (
          <div className="border-t border-white/10 bg-gray-900/40 px-5 py-3 text-xs text-gray-500">
            Pour les replays vidéo et les heatmaps, ouvre le projet sur{' '}
            <a
              href={`https://clarity.microsoft.com/projects/view/${store.clarity_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
            >
              Microsoft Clarity &#8599;
            </a>
            .
          </div>
        )}
      </AdminCard>

      {/* UA — Acquisition by source/campaign */}
      <AdminCard>
        <AdminCardHeader
          title={
            <span>
              Acquisition <em className="font-normal not-italic text-gray-500">(UA)</em>
            </span>
          }
        />
        <div className="px-5 pt-4 pb-1">
          <p className="text-xs text-gray-500">
            Décomposition par utm_source / utm_campaign. Les visiteurs sans UTM sont regroupés sous{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
              (direct)
            </code>
            .
          </p>
        </div>
        {acquisitionRes.rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Aucun évènement enregistré sur cette période.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Campagne</th>
                  <th className="px-5 py-3 text-right font-medium">Sessions</th>
                  <th className="px-5 py-3 text-right font-medium">Cart</th>
                  <th className="px-5 py-3 text-right font-medium">Checkout</th>
                  <th className="px-5 py-3 text-right font-medium">Achats</th>
                  <th className="px-5 py-3 text-right font-medium">Revenu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {acquisitionRes.rows.map((r, i) => {
                  const conv = r.adds_to_cart > 0 ? (r.purchases / r.adds_to_cart) * 100 : 0;
                  return (
                    <tr key={i}>
                      <td className="px-5 py-3 font-medium text-white">{r.source}</td>
                      <td className="px-5 py-3 text-gray-400">{r.campaign}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-400">{r.visits}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-400">
                        {r.adds_to_cart}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-400">
                        {r.initiate_checkouts}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <span className="font-medium text-white">{r.purchases}</span>
                        {r.adds_to_cart > 0 && (
                          <span className="ml-1.5 text-[10px] text-gray-500">{conv.toFixed(0)} %</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-white">
                        {r.revenue_minor > 0 ? formatMoney(r.revenue_minor / 100, 'eur') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Pixel/CAPI status */}
      <div className="rounded-xl border border-dashed border-white/15 bg-gray-800/30 px-5 py-4">
        <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Plomberie connectée
        </h4>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <ConnState label="GA4" set={!!store.ga4_measurement_id} />
          <ConnState label="Meta Pixel" set={!!store.meta_pixel_id} />
          <ConnState label="TikTok Pixel" set={!!store.tiktok_pixel_id} />
          <ConnState label="Clarity" set={!!store.clarity_id} />
        </div>
        <p className="mt-4 text-xs text-gray-500">
          IDs vides ?{' '}
          <Link
            href={`/admin/stores/${id}/settings`}
            className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
          >
            Configure-les dans les Réglages
          </Link>
        </p>
      </div>
    </div>
  );
}

function ConnState({ label, set }: { label: string; set: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={
          'inline-block size-1.5 shrink-0 rounded-full ' + (set ? 'bg-indigo-400' : 'bg-white/20')
        }
        aria-hidden="true"
      />
      <span className={set ? 'font-semibold text-white' : 'text-gray-400'}>{label}</span>
      <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">
        {set ? 'connecté' : 'inactif'}
      </span>
    </div>
  );
}
