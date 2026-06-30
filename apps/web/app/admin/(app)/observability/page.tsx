import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text, TextLink } from '@/components/catalyst/text';
import { Badge } from '@/components/catalyst/badge';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/catalyst/table';
import {
  DescriptionTerm,
  DescriptionDetails,
} from '@/components/catalyst/description-list';
import { getAllCampaigns, getChannelConnections, type AdChannel } from '@/lib/ads/all-campaigns';

export const dynamic = 'force-dynamic';

const CHANNEL_LABEL: Record<string, string> = {
  google: 'Google Ads',
  meta: 'Meta (FB/IG)',
  tiktok: 'TikTok Ads',
  amazon: 'Amazon Ads',
};

const CHANNEL_BADGE: Record<string, 'blue' | 'indigo' | 'pink' | 'amber' | 'zinc'> = {
  google: 'blue',
  meta: 'indigo',
  tiktok: 'pink',
  amazon: 'amber',
};

const STATUS_BADGE: Record<string, 'green' | 'zinc' | 'red'> = {
  live: 'green',
  active: 'green',
  paused: 'zinc',
  draft: 'zinc',
  error: 'red',
};

function eur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function roas(revenue: number, spent: number): string {
  return spent > 0 ? `×${(revenue / spent).toFixed(2)}` : '—';
}

export default async function ObservabilityPage() {
  const [campaigns, connections] = await Promise.all([
    getAllCampaigns(),
    Promise.resolve(getChannelConnections()),
  ]);

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
          <Heading>Campagnes & revenus</Heading>
          <Text className="mt-1 max-w-2xl">
            Campagnes réelles publiées depuis la plateforme (Google, Meta, TikTok, Amazon).
            Dépenses estimées sur le budget, revenus mesurés sur les events de conversion.
          </Text>
        </div>
      </div>

      {/* KPIs globaux — réels */}
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

      {/* Par canal — connexion réelle + perfs réelles */}
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
                  <Badge color={CHANNEL_BADGE[c.channel]}>{CHANNEL_LABEL[c.channel]}</Badge>
                </TableCell>
                <TableCell>
                  {c.connected ? <Badge color="green">Connecté</Badge> : <Badge color="zinc">Non connecté</Badge>}
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

      {/* Campagnes — réelles */}
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
                      <Badge color={STATUS_BADGE[c.status] ?? 'zinc'}>{c.status}</Badge>
                      <span className="font-medium text-zinc-950 dark:text-white">{c.hook ?? 'Campagne'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge color={CHANNEL_BADGE[c.channel] ?? 'zinc'}>{CHANNEL_LABEL[c.channel] ?? c.channel}</Badge>
                  </TableCell>
                  <TableCell className="text-zinc-500">{c.storeName ?? '—'}</TableCell>
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
        )}
      </section>
    </div>
  );
}
