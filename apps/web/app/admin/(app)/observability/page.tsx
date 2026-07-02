import { Subheading } from '@/components/catalyst/heading';
import { Text, TextLink } from '@/components/catalyst/text';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminBadge } from '@/components/admin/AdminBadge';
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
  let campaigns: Awaited<ReturnType<typeof getAllCampaigns>> = [];
  let connections: ReturnType<typeof getChannelConnections> = [];
  let dataError = false;
  try {
    [campaigns, connections] = await Promise.all([
      getAllCampaigns(),
      Promise.resolve(getChannelConnections()),
    ]);
  } catch (err) {
    console.error('[observability] chargement campagnes/connexions échoué:', err);
    dataError = true;
  }

  const totalSpent = campaigns.reduce((s, c) => s + c.spentEur, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenueEur, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalViews = campaigns.reduce((s, c) => s + c.views, 0);
  const activeCount = campaigns.filter((c) => c.status === 'live' || c.status === 'active').length;

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
        title="Campagnes & revenus"
        subtitle="Campagnes réelles publiées depuis la plateforme (Google, Meta, TikTok, Amazon). Dépenses estimées sur le budget, revenus mesurés sur les events de conversion."
        meta="Marketing · Pub payée"
      />

      {dataError && (
        <div className="rounded-md border border-zinc-950/10 bg-zinc-950/[0.02] px-4 py-3 text-sm text-zinc-950 dark:border-white/10 dark:bg-white/[0.02] dark:text-white">
          Données temporairement indisponibles. Réessaie dans un instant.
        </div>
      )}

      <section className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <Subheading>Vue d&apos;ensemble</Subheading>
        <dl className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0">
            <DescriptionTerm>Dépensé (estimé)</DescriptionTerm>
            <DescriptionDetails className="tabular-nums">{eur(totalSpent)}</DescriptionDetails>
          </div>
          <div className="min-w-0">
            <DescriptionTerm>Revenus</DescriptionTerm>
            <DescriptionDetails className="tabular-nums">{eur(totalRevenue)}</DescriptionDetails>
          </div>
          <div className="min-w-0">
            <DescriptionTerm>ROAS global</DescriptionTerm>
            <DescriptionDetails className="tabular-nums">{roas(totalRevenue, totalSpent)}</DescriptionDetails>
          </div>
          <div className="min-w-0">
            <DescriptionTerm>Conversions</DescriptionTerm>
            <DescriptionDetails className="tabular-nums">{totalConversions.toLocaleString('fr-FR')}</DescriptionDetails>
          </div>
          <div className="min-w-0">
            <DescriptionTerm>Vues produit</DescriptionTerm>
            <DescriptionDetails className="tabular-nums">{totalViews.toLocaleString('fr-FR')}</DescriptionDetails>
          </div>
          <div className="min-w-0">
            <DescriptionTerm>Campagnes actives</DescriptionTerm>
            <DescriptionDetails className="tabular-nums">{String(activeCount)}</DescriptionDetails>
          </div>
        </dl>
      </section>

      <section className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <Subheading>Par canal</Subheading>
        <Table dense className="mt-4 [--gutter:--spacing(4)]">
          <TableHead>
            <TableRow>
              <TableHeader>Canal</TableHeader>
              <TableHeader>État</TableHeader>
              <TableHeader className="text-right">Dépensé</TableHeader>
              <TableHeader className="text-right">Revenus</TableHeader>
              <TableHeader className="text-right">ROAS</TableHeader>
              <TableHeader className="text-right">Campagnes</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {byChannel.map((c) => (
              <TableRow key={c.channel}>
                <TableCell>
                  <ChannelLabel channel={c.channel} connected={c.connected} />
                </TableCell>
                <TableCell>
                  <AdminBadge status={c.connected ? 'connected' : 'zinc'}>
                    {c.connected ? 'Connecté' : 'Non connecté'}
                  </AdminBadge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{eur(c.spent)}</TableCell>
                <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{eur(c.revenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{roas(c.revenue, c.spent)}</TableCell>
                <TableCell className="text-right tabular-nums text-zinc-500">{c.active} active(s)</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <Subheading>Campagnes</Subheading>
        {campaigns.length === 0 ? (
          <div className="mt-4">
            <Text>
              Aucune campagne publiée pour le moment. Lance une campagne depuis un store (ou via le Super Agent)
              une fois un canal connecté dans <TextLink href="/admin/settings">Réglages</TextLink>.
            </Text>
          </div>
        ) : (
          <Table dense className="mt-4 [--gutter:--spacing(4)]">
            <TableHead>
              <TableRow>
                <TableHeader>Campagne</TableHeader>
                <TableHeader>Canal</TableHeader>
                <TableHeader>Store</TableHeader>
                <TableHeader className="text-right">Budget/j</TableHeader>
                <TableHeader className="text-right">Dépensé</TableHeader>
                <TableHeader className="text-right">Revenus</TableHeader>
                <TableHeader className="text-right">ROAS</TableHeader>
                <TableHeader className="text-right">Conv.</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AdminBadge status={c.status}>{c.status}</AdminBadge>
                      <span className="font-medium text-zinc-950 dark:text-white">{c.hook ?? 'Campagne'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChannelLabel channel={c.channel} connected />
                  </TableCell>
                  <TableCell className="text-zinc-500">{c.storeName ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-zinc-500">
                    {c.dailyBudgetEur != null ? `${eur(c.dailyBudgetEur)}/j` : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{eur(c.spentEur)}</TableCell>
                  <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{eur(c.revenueEur)}</TableCell>
                  <TableCell className="text-right tabular-nums">{roas(c.revenueEur, c.spentEur)}</TableCell>
                  <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{c.conversions}</TableCell>
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
