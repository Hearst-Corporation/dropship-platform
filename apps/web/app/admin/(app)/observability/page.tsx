import { Subheading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
import { Button } from '@/components/catalyst/button';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/catalyst/table';
import { CpuChipIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSection } from '@/components/admin/AdminSection';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminActionMenu } from '@/components/admin/AdminActionMenu';
import { getDbRead } from '@/lib/db';
import { getAllCampaigns, getChannelConnections, type AdChannel } from '@/lib/ads/all-campaigns';

export const dynamic = 'force-dynamic';

const CHANNEL_LABEL: Record<string, string> = {
  google: 'Google Ads',
  meta: 'Meta (FB/IG)',
  tiktok: 'TikTok Ads',
  amazon: 'Amazon Ads',
};

/**
 * Neutral platform label. Single-accent policy: NO per-platform hue. A small
 * zinc dot precedes the channel name; connected channels get an indigo dot
 * (the accent) so the live channels read at a glance without introducing a
 * second colour.
 */
function ChannelLabel({ channel, connected }: { channel: string; connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-medium text-zinc-950 dark:text-white">
      <span
        aria-hidden="true"
        className={
          connected
            ? 'size-1.5 shrink-0 rounded-full bg-indigo-500'
            : 'size-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600'
        }
      />
      {CHANNEL_LABEL[channel] ?? channel}
    </span>
  );
}

function eur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function eurCost(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
/** Per-run AI costs are often sub-cent: keep up to 4 decimals. */
function eurPerRun(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}
function roas(revenue: number, spent: number): string {
  return spent > 0 ? `×${(revenue / spent).toFixed(2)}` : '—';
}
function formatLatency(ms: number): string {
  if (ms >= 10_000) return `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
  return `${Math.round(ms).toLocaleString('fr-FR')} ms`;
}
function formatTokens(n: number): string {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

const RUN_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const PUSHED_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });

interface AiKpiRow {
  total_cost_eur: string;
  runs: number;
  errors: number;
  avg_latency_ms: string;
}
interface AiModelRow {
  model: string;
  runs: number;
  input_tokens: string;
  output_tokens: string;
  cost_eur: string;
  avg_cost_eur: string;
}
interface AiRunRow {
  id: string;
  created_at: string;
  step: string;
  store_name: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_eur: string;
  has_error: boolean;
}

/** Fail-soft : une requête en erreur retombe sur son fallback sans crasher la page. */
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error('[observability] query failed:', e instanceof Error ? e.message : e);
    return fallback;
  }
}

export default async function ObservabilityPage() {
  const db = getDbRead();
  const connections = getChannelConnections();

  const [aiKpi, aiModels, aiRuns, campaignsResult] = await Promise.all([
    safeQuery<AiKpiRow>(
      async () => {
        const { rows } = await db.query<AiKpiRow>(
          `SELECT
             COALESCE(SUM(cost_eur), 0)::numeric(12,4)::text AS total_cost_eur,
             COUNT(*)::int AS runs,
             COUNT(*) FILTER (WHERE error_json IS NOT NULL)::int AS errors,
             COALESCE(AVG(latency_ms), 0)::numeric(12,0)::text AS avg_latency_ms
           FROM dropship_ai_runs
           WHERE created_at > now() - interval '30 days'`,
        );
        return rows[0]!;
      },
      { total_cost_eur: '0', runs: 0, errors: 0, avg_latency_ms: '0' },
    ),
    safeQuery<AiModelRow[]>(
      async () => {
        const { rows } = await db.query<AiModelRow>(
          `SELECT
             model,
             COUNT(*)::int AS runs,
             COALESCE(SUM(input_tokens), 0)::bigint::text AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint::text AS output_tokens,
             COALESCE(SUM(cost_eur), 0)::numeric(12,4)::text AS cost_eur,
             COALESCE(AVG(cost_eur), 0)::numeric(12,6)::text AS avg_cost_eur
           FROM dropship_ai_runs
           WHERE created_at > now() - interval '30 days'
           GROUP BY model
           ORDER BY SUM(cost_eur) DESC, COUNT(*) DESC`,
        );
        return rows;
      },
      [],
    ),
    safeQuery<AiRunRow[]>(
      async () => {
        const { rows } = await db.query<AiRunRow>(
          `SELECT
             r.id,
             r.created_at,
             r.step,
             s.name AS store_name,
             r.model,
             r.input_tokens,
             r.output_tokens,
             r.latency_ms,
             r.cost_eur::numeric(12,6)::text AS cost_eur,
             (r.error_json IS NOT NULL) AS has_error
           FROM dropship_ai_runs r
           LEFT JOIN dropship_stores s ON s.id = r.store_id
           ORDER BY r.created_at DESC
           LIMIT 20`,
        );
        return rows;
      },
      [],
    ),
    safeQuery<Awaited<ReturnType<typeof getAllCampaigns>> | null>(() => getAllCampaigns(), null),
  ]);

  const dataError = campaignsResult === null;
  const campaigns = campaignsResult ?? [];

  const aiTotalCost = Number(aiKpi.total_cost_eur || 0);
  const aiAvgLatency = Number(aiKpi.avg_latency_ms || 0);
  const aiErrorRate = aiKpi.runs ? (aiKpi.errors / aiKpi.runs) * 100 : 0;

  const totalSpent = campaigns.reduce((s, c) => s + c.spentEur, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenueEur, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalViews = campaigns.reduce((s, c) => s + c.views, 0);
  const activeCount = campaigns.filter((c) => c.status === 'live' || c.status === 'active').length;

  // Per-channel aggregation from REAL campaigns.
  const channels: AdChannel[] = ['google', 'meta', 'tiktok', 'amazon'];
  const byChannel = channels.map((ch) => {
    const cc = campaigns.filter((c) => c.channel === ch);
    return {
      channel: ch,
      spent: cc.reduce((s, c) => s + c.spentEur, 0),
      revenue: cc.reduce((s, c) => s + c.revenueEur, 0),
      active: cc.filter((c) => c.status === 'live' || c.status === 'active').length,
      connected: connections.find((x) => x.channel === ch)?.connected ?? false,
    };
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Observabilité"
        subtitle="Coûts, latences et erreurs des runs IA sur 30 jours, puis performances des campagnes publiées depuis la plateforme."
      />

      {dataError && (
        <div className="rounded-md border border-zinc-950/10 bg-zinc-950/[0.02] px-4 py-3 text-sm text-zinc-950 dark:border-white/10 dark:bg-white/[0.02] dark:text-white">
          Données campagnes temporairement indisponibles. Réessaie dans un instant.
        </div>
      )}

      {/* Observabilité IA — KPIs 30 jours (source : dropship_ai_runs) */}
      <AdminStatsGrid cols={4}>
        <AdminStatCard
          label="Coût IA 30j"
          value={eurCost(aiTotalCost)}
          hint={`${aiKpi.runs.toLocaleString('fr-FR')} appels Anthropic`}
        />
        <AdminStatCard
          label="Runs 30j"
          value={aiKpi.runs.toLocaleString('fr-FR')}
          hint={`${aiKpi.errors.toLocaleString('fr-FR')} en erreur`}
        />
        <AdminStatCard
          label="Taux d'erreur 30j"
          value={`${aiErrorRate.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`}
        />
        <AdminStatCard label="Latence moyenne 30j" value={formatLatency(aiAvgLatency)} />
      </AdminStatsGrid>

      {/* Observabilité IA — coût par modèle + runs récents */}
      <div className="grid grid-cols-1 items-start gap-8 2xl:grid-cols-2">
        <AdminSection
          title="Coût par modèle"
          description="Runs des 30 derniers jours agrégés par modèle, classés par coût."
          flush
        >
          {aiModels.length === 0 ? (
            <AdminEmptyState
              icon={CpuChipIcon}
              title="Aucun run IA sur 30 jours"
              description="Les coûts par modèle apparaîtront dès le prochain appel IA (création de store, copilotes)."
            />
          ) : (
            <AdminDataTable minWidth="min-w-[36rem]" bare>
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>Modèle</TableHeader>
                    <TableHeader className="text-right">Runs</TableHeader>
                    <TableHeader className="text-right">Tokens in</TableHeader>
                    <TableHeader className="text-right">Tokens out</TableHeader>
                    <TableHeader className="text-right">Coût</TableHeader>
                    <TableHeader className="text-right">Coût moyen/run</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aiModels.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell>
                        <span
                          className="block max-w-[14rem] truncate font-medium text-zinc-950 dark:text-white"
                          title={m.model}
                        >
                          {m.model}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {m.runs.toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatTokens(Number(m.input_tokens))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatTokens(Number(m.output_tokens))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">
                        {eurCost(Number(m.cost_eur))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {eurPerRun(Number(m.avg_cost_eur))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminDataTable>
          )}
        </AdminSection>

        <AdminSection
          title="Runs récents"
          description="Les 20 derniers appels IA, tous stores confondus : étape, store, modèle, tokens, latence, coût."
          flush
        >
          {aiRuns.length === 0 ? (
            <AdminEmptyState
              icon={CpuChipIcon}
              title="Aucun run IA enregistré"
              description="Chaque appel Anthropic de la plateforme est journalisé ici avec son coût et sa latence."
            />
          ) : (
            <AdminDataTable minWidth="min-w-[56rem]" bare>
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>Date</TableHeader>
                    <TableHeader>Étape</TableHeader>
                    <TableHeader>Store</TableHeader>
                    <TableHeader>Modèle</TableHeader>
                    <TableHeader className="text-right">Tokens in/out</TableHeader>
                    <TableHeader className="text-right">Latence</TableHeader>
                    <TableHeader className="text-right">Coût</TableHeader>
                    <TableHeader>Statut</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aiRuns.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap tabular-nums text-zinc-500 dark:text-zinc-400">
                        {RUN_DATE.format(new Date(r.created_at))}
                      </TableCell>
                      <TableCell>
                        <span
                          className="block max-w-[10rem] truncate font-medium text-zinc-950 dark:text-white"
                          title={r.step}
                        >
                          {r.step}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="block max-w-[9rem] truncate text-zinc-500 dark:text-zinc-400"
                          title={r.store_name ?? undefined}
                        >
                          {r.store_name ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="block max-w-[10rem] truncate text-zinc-500 dark:text-zinc-400"
                          title={r.model}
                        >
                          {r.model}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatTokens(r.input_tokens)} / {formatTokens(r.output_tokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatLatency(r.latency_ms)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">
                        {eurPerRun(Number(r.cost_eur))}
                      </TableCell>
                      <TableCell>
                        <AdminBadge status={r.has_error ? 'error' : 'ok'}>
                          {r.has_error ? 'Erreur' : 'OK'}
                        </AdminBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminDataTable>
          )}
        </AdminSection>
      </div>

      {/* Campagnes publicitaires — réelles */}
      <div className="space-y-6 border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="min-w-0">
          <Subheading level={2}>Campagnes publicitaires</Subheading>
          <Text className="mt-1 max-w-2xl">
            Campagnes réelles publiées depuis la plateforme (Google, Meta, TikTok, Amazon).
            Dépenses estimées sur le budget, revenus mesurés sur les events de conversion.
          </Text>
        </div>

        {/* KPIs globaux — réels */}
        <AdminStatsGrid cols={6}>
          <AdminStatCard label="Dépensé (est.)" value={eur(totalSpent)} />
          <AdminStatCard label="Revenus" value={eur(totalRevenue)} />
          <AdminStatCard label="ROAS global (est.)" value={roas(totalRevenue, totalSpent)} />
          <AdminStatCard label="Conversions" value={totalConversions.toLocaleString('fr-FR')} />
          <AdminStatCard label="Vues produit" value={totalViews.toLocaleString('fr-FR')} />
          <AdminStatCard label="Campagnes actives" value={String(activeCount)} />
        </AdminStatsGrid>

        {/* Par canal — connexion réelle + perfs réelles */}
        <AdminSection
          title="Par canal"
          description="Connexion réelle et performances agrégées par plateforme."
          flush
        >
          <AdminDataTable minWidth="min-w-[42rem]" bare>
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Canal</TableHeader>
                  <TableHeader>État</TableHeader>
                  <TableHeader className="text-right">Dépensé (est.)</TableHeader>
                  <TableHeader className="text-right">Revenus</TableHeader>
                  <TableHeader className="text-right">ROAS (est.)</TableHeader>
                  <TableHeader className="text-right">Actives</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {byChannel.map((c) => (
                  <TableRow key={c.channel}>
                    <TableCell>
                      <ChannelLabel channel={c.channel} connected={c.connected} />
                    </TableCell>
                    <TableCell>
                      <AdminBadge status={c.connected ? 'connected' : 'offline'}>
                        {c.connected ? 'Connecté' : 'Non connecté'}
                      </AdminBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{eur(c.spent)}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{eur(c.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{roas(c.revenue, c.spent)}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">{c.active}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
        </AdminSection>

        {/* Campagnes — réelles */}
        <AdminSection
          title="Campagnes"
          description="Campagnes publiées, canal et store. Dépenses estimées, revenus mesurés."
          flush
        >
          {campaigns.length === 0 ? (
            <AdminEmptyState
              icon={MegaphoneIcon}
              title="Aucune campagne publiée"
              description="Lance une campagne depuis un store ou via le Super Agent une fois un canal connecté."
              action={
                <Button href="/admin/settings" outline>
                  Connecter un canal
                </Button>
              }
            />
          ) : (
            <AdminDataTable minWidth="min-w-[58rem]" bare>
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>Campagne</TableHeader>
                    <TableHeader>Canal / Store</TableHeader>
                    <TableHeader className="text-right">Budget/j</TableHeader>
                    <TableHeader className="text-right">Dépensé (est.)</TableHeader>
                    <TableHeader className="text-right">Revenus</TableHeader>
                    <TableHeader className="text-right">ROAS (est.)</TableHeader>
                    <TableHeader className="text-right">Conv.</TableHeader>
                    <TableHeader className="text-right">Publiée</TableHeader>
                    <TableHeader className="text-right">Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <AdminBadge status={c.status} />
                          <span
                            className="block max-w-[18rem] truncate font-medium text-zinc-950 dark:text-white"
                            title={c.hook ?? undefined}
                          >
                            {c.hook ?? 'Campagne'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-zinc-950 dark:text-white">
                          {CHANNEL_LABEL[c.channel] ?? c.channel}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{c.storeName ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {c.dailyBudgetEur != null ? `${eur(c.dailyBudgetEur)}/j` : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{eur(c.spentEur)}</TableCell>
                      <TableCell className="text-right tabular-nums text-indigo-600 dark:text-indigo-400">{eur(c.revenueEur)}</TableCell>
                      <TableCell className="text-right tabular-nums">{roas(c.revenueEur, c.spentEur)}</TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{c.conversions}</TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums text-zinc-500 dark:text-zinc-400">
                        {c.pushedAt ? PUSHED_DATE.format(new Date(c.pushedAt)) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          {c.storeSlug ? (
                            <AdminActionMenu
                              ariaLabel={`Actions pour la campagne ${c.hook ?? c.id}`}
                              actions={[
                                {
                                  label: 'Analytics du store',
                                  href: `/admin/stores/${c.storeSlug}/analytics`,
                                },
                                { label: 'Voir la landing', href: `/shop/${c.storeSlug}` },
                              ]}
                            />
                          ) : (
                            <span className="text-zinc-500 dark:text-zinc-400">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminDataTable>
          )}
        </AdminSection>
      </div>
    </div>
  );
}
