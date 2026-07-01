import { Heading } from '@/components/catalyst/heading';
import { Text, TextLink } from '@/components/catalyst/text';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/catalyst/table';
import { AdminSection } from '@/components/admin/AdminSection';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { getAllCampaigns, getChannelConnections, type AdChannel } from '@/lib/ads/all-campaigns';
import { getDbRead } from '@/lib/db';

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
function roas(revenue: number, spent: number): string {
  return spent > 0 ? `×${(revenue / spent).toFixed(2)}` : '—';
}

interface AiRunRow {
  id: string;
  step: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_eur: string | number;
  error_json: string | null;
  created_at: string;
  store_name: string | null;
}

/** Last agent model calls (store-creator, enrichment, vision, ads plan…). Fail-soft. */
async function getRecentAiRuns(): Promise<AiRunRow[]> {
  try {
    const db = getDbRead();
    const { rows } = await db.query<AiRunRow>(
      `SELECT r.id, r.step, r.model, r.input_tokens, r.output_tokens, r.latency_ms,
              r.cost_eur, r.error_json, r.created_at, s.name AS store_name
       FROM dropship_ai_runs r
       LEFT JOIN dropship_stores s ON s.id = r.store_id
       ORDER BY r.created_at DESC
       LIMIT 20`,
    );
    return rows;
  } catch (err) {
    console.error('[observability] chargement runs IA échoué:', err);
    return [];
  }
}

export default async function ObservabilityPage() {
  // Fail-soft : une erreur DB ne doit pas crasher la page. On retombe sur des
  // données vides et on affiche une bannière neutre pour le signaler.
  let campaigns: Awaited<ReturnType<typeof getAllCampaigns>> = [];
  let connections: ReturnType<typeof getChannelConnections> = [];
  let dataError = false;
  const aiRuns = await getRecentAiRuns();
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Text>Marketing · Pub payée</Text>
          <Heading>Campagnes &amp; revenus</Heading>
          <Text className="mt-1 max-w-2xl">
            Campagnes réelles publiées depuis la plateforme (Google, Meta, TikTok, Amazon).
            Dépenses estimées sur le budget, revenus mesurés sur les events de conversion.
          </Text>
        </div>
      </div>

      {dataError && (
        <div className="rounded-md border border-zinc-950/10 bg-zinc-950/[0.02] px-4 py-3 text-sm text-zinc-950 dark:border-white/10 dark:bg-white/[0.02] dark:text-white">
          Données temporairement indisponibles. Réessaie dans un instant.
        </div>
      )}

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
        <AdminDataTable minWidth="min-w-[42rem]">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Canal</TableHeader>
                <TableHeader>État</TableHeader>
                <TableHeader className="text-right">Dépensé (est.)</TableHeader>
                <TableHeader className="text-right">Revenus</TableHeader>
                <TableHeader className="text-right">ROAS (est.)</TableHeader>
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
                    <AdminBadge status={c.connected ? 'connected' : 'offline'}>
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
        </AdminDataTable>
      </AdminSection>

      {/* Campagnes — réelles */}
      <AdminSection
        title="Campagnes"
        description="Campagnes publiées, canal et store. Dépenses estimées, revenus mesurés."
        flush={campaigns.length > 0}
      >
        {campaigns.length === 0 ? (
          <Text>
            Aucune campagne publiée pour le moment. Lance une campagne depuis un store (ou via le Super Agent)
            une fois un canal connecté dans <TextLink href="/admin/settings">Réglages</TextLink>.
          </Text>
        ) : (
          <AdminDataTable minWidth="min-w-[42rem]">
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
                </TableRow>
              </TableHead>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AdminBadge status={c.status} />
                        <span className="font-medium text-zinc-950 dark:text-white">{c.hook ?? 'Campagne'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-zinc-950 dark:text-white">
                        {CHANNEL_LABEL[c.channel] ?? c.channel}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">{c.storeName ?? '—'}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500">
                      {c.dailyBudgetEur != null ? `${eur(c.dailyBudgetEur)}/j` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{eur(c.spentEur)}</TableCell>
                    <TableCell className="text-right tabular-nums text-indigo-600 dark:text-indigo-400">{eur(c.revenueEur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{roas(c.revenueEur, c.spentEur)}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">{c.conversions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
        )}
      </AdminSection>

      {/* Runs IA — ledger des appels agent (store-creator, enrichment, vision, plan ads) */}
      <AdminSection
        title="Runs IA"
        description="Derniers appels du moteur agentique: étape, modèle, tokens, latence, coût."
        flush={aiRuns.length > 0}
      >
        {aiRuns.length === 0 ? (
          <Text>Aucun run IA enregistré pour le moment. Lance une création de store pour alimenter le ledger.</Text>
        ) : (
          <AdminDataTable minWidth="min-w-[52rem]">
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Étape</TableHeader>
                  <TableHeader>Store</TableHeader>
                  <TableHeader>Modèle</TableHeader>
                  <TableHeader className="text-right">Tokens in/out</TableHeader>
                  <TableHeader className="text-right">Latence</TableHeader>
                  <TableHeader className="text-right">Coût</TableHeader>
                  <TableHeader>État</TableHeader>
                  <TableHeader className="text-right">Quand</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {aiRuns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-white">{r.step}</TableCell>
                    <TableCell className="text-zinc-500">{r.store_name ?? '—'}</TableCell>
                    <TableCell className="text-zinc-500">{r.model}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.input_tokens.toLocaleString('fr-FR')} / {r.output_tokens.toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{(r.latency_ms / 1000).toFixed(1)}s</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.cost_eur).toFixed(4)} €</TableCell>
                    <TableCell>
                      <AdminBadge status={r.error_json ? 'error' : 'ok'}>
                        {r.error_json ? 'Erreur' : 'OK'}
                      </AdminBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500">
                      {new Date(r.created_at).toLocaleTimeString('fr-FR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
        )}
      </AdminSection>
    </div>
  );
}
