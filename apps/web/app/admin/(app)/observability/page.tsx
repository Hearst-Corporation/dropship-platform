import { Subheading } from "@/components/ui/heading";
import { Text, TextLink } from "@/components/ui/text";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "@/components/ui/description-list";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/table";
import {
  CpuChipIcon,
  MegaphoneIcon,
  CurrencyEuroIcon,
  ArrowTrendingUpIcon,
  ShoppingCartIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminTruncatedText } from "@/components/admin/AdminTruncatedText";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminActionMenu } from "@/components/admin/AdminActionMenu";
import { getDbRead } from "@/lib/db";
import {
  getAllCampaigns,
  getChannelConnections,
  type AdChannel,
} from "@/lib/ads/all-campaigns";
import {
  formatEurCurrency as eur,
  formatEurCurrencyCents as eurCost,
  formatEurCurrencyPrecise as eurPerRun,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta (FB/IG)",
  tiktok: "TikTok Ads",
  amazon: "Amazon Ads",
};

function ChannelLabel({
  channel,
  connected,
}: {
  channel: string;
  connected: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 font-medium text-white">
      <span
        aria-hidden="true"
        className={
          connected
            ? "size-1.5 shrink-0 rounded-full bg-indigo-500"
            : "size-1.5 shrink-0 rounded-full bg-zinc-600"
        }
      />
      {CHANNEL_LABEL[channel] ?? channel}
    </span>
  );
}

function roas(revenue: number, spent: number): string {
  return spent > 0 ? `×${(revenue / spent).toFixed(2)}` : "—";
}
function formatLatency(ms: number): string {
  if (ms >= 10_000)
    return `${(ms / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`;
  return `${Math.round(ms).toLocaleString("fr-FR")} ms`;
}
function formatTokens(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

const RUN_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const PUSHED_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

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
    console.error(
      "[observability] query failed:",
      e instanceof Error ? e.message : e,
    );
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
    console.error(
      "[observability] chargement campagnes/connexions échoué:",
      err,
    );
    dataError = true;
  }

  const totalSpent = campaigns.reduce((s, c) => s + c.spentEur, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenueEur, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalViews = campaigns.reduce((s, c) => s + c.views, 0);
  const activeCount = campaigns.filter(
    (c) => c.status === "live" || c.status === "active",
  ).length;

  const channels: AdChannel[] = ["google", "meta", "tiktok", "amazon"];
  const byChannel = channels.map((ch) => {
    const cc = campaigns.filter((c) => c.channel === ch);
    return {
      channel: ch,
      spent: cc.reduce((s, c) => s + c.spentEur, 0),
      revenue: cc.reduce((s, c) => s + c.revenueEur, 0),
      active: cc.filter((c) => c.status === "live" || c.status === "active")
        .length,
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
        <div className="rounded-md border border-admin-border bg-admin-surface-panel px-4 py-3 text-sm text-white">
          Données temporairement indisponibles. Réessaie dans un instant.
        </div>
      )}

      <AdminStatsGrid cols={3}>
        <AdminStatCard
          label="Dépensé (estimé)"
          value={eur(totalSpent)}
          icon={CurrencyEuroIcon}
        />
        <AdminStatCard
          label="Revenus"
          value={eur(totalRevenue)}
          icon={CurrencyEuroIcon}
        />
        <AdminStatCard
          label="ROAS global"
          value={roas(totalRevenue, totalSpent)}
          icon={ArrowTrendingUpIcon}
        />
        <AdminStatCard
          label="Conversions"
          value={totalConversions.toLocaleString("fr-FR")}
          icon={ShoppingCartIcon}
        />
        <AdminStatCard
          label="Vues produit"
          value={totalViews.toLocaleString("fr-FR")}
          icon={EyeIcon}
        />
        <AdminStatCard
          label="Campagnes actives"
          value={String(activeCount)}
          icon={MegaphoneIcon}
        />
      </AdminStatsGrid>

      <AdminSection title="Par canal" flush>
        <AdminDataTable fixedLayout>
          <Table dense bleed>
            <colgroup>
              <col />
              <col style={{ width: "7rem" }} />
              <col style={{ width: "5.5rem" }} />
              <col style={{ width: "5.5rem" }} />
              <col style={{ width: "4.5rem" }} />
              <col style={{ width: "6.5rem" }} />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableHeader>Canal</TableHeader>
                <TableHeader>État</TableHeader>
                <TableHeader className="text-right hidden sm:table-cell">
                  Dépensé
                </TableHeader>
                <TableHeader className="text-right hidden sm:table-cell">
                  Revenus
                </TableHeader>
                <TableHeader className="text-right">ROAS</TableHeader>
                <TableHeader className="text-right hidden md:table-cell">
                  Campagnes
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody className="[&>tr:last-child>td]:border-b-0">
              {byChannel.map((c) => (
                <TableRow key={c.channel}>
                  <TableCell>
                    <ChannelLabel channel={c.channel} connected={c.connected} />
                  </TableCell>
                  <TableCell>
                    <AdminBadge status={c.connected ? "connected" : "zinc"}>
                      {c.connected ? "Connecté" : "Non connecté"}
                    </AdminBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-white hidden sm:table-cell">
                    {eur(c.spent)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-white hidden sm:table-cell">
                    {eur(c.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {roas(c.revenue, c.spent)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-zinc-500 hidden md:table-cell">
                    {c.active} active(s)
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDataTable>
      </AdminSection>

      <AdminSection title="Campagnes" flush>
        {campaigns.length === 0 ? (
          <div className="px-6 py-5 sm:px-8">
            <Text>
              Aucune campagne publiée pour le moment. Lance une campagne depuis
              un store (ou via le Super Agent) une fois un canal connecté dans{" "}
              <TextLink href="/admin/settings">Réglages</TextLink>.
            </Text>
          </div>
        ) : (
          <AdminDataTable fixedLayout>
            <Table dense bleed>
              <colgroup>
                <col />
                <col style={{ width: "9rem" }} />
                <col style={{ width: "5.5rem" }} />
                <col style={{ width: "5.5rem" }} />
                <col style={{ width: "5.5rem" }} />
                <col style={{ width: "4.5rem" }} />
                <col style={{ width: "4rem" }} />
                <col style={{ width: "5.5rem" }} />
                <col style={{ width: "6rem" }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  <TableHeader>Campagne</TableHeader>
                  <TableHeader className="hidden lg:table-cell">
                    Canal / Store
                  </TableHeader>
                  <TableHeader className="text-right hidden sm:table-cell">
                    Budget/j
                  </TableHeader>
                  <TableHeader className="text-right hidden md:table-cell">
                    Dépensé (est.)
                  </TableHeader>
                  <TableHeader className="text-right hidden sm:table-cell">
                    Revenus
                  </TableHeader>
                  <TableHeader className="text-right">ROAS (est.)</TableHeader>
                  <TableHeader className="text-right hidden lg:table-cell">
                    Conv.
                  </TableHeader>
                  <TableHeader className="text-right hidden md:table-cell">
                    Publiée
                  </TableHeader>
                  <TableHeader className="text-right">Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody className="[&>tr:last-child>td]:border-b-0">
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <AdminBadge status={c.status} />
                        <AdminTruncatedText
                          className="font-medium text-white"
                          title={c.hook ?? "Campagne"}
                        >
                          {c.hook ?? "Campagne"}
                        </AdminTruncatedText>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 hidden lg:table-cell">
                      <div className="font-medium text-white">
                        {CHANNEL_LABEL[c.channel] ?? c.channel}
                      </div>
                      <AdminTruncatedText
                        className="mt-0.5 text-xs text-zinc-500"
                        title={c.storeName ?? undefined}
                      >
                        {c.storeName ?? "—"}
                      </AdminTruncatedText>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500 hidden sm:table-cell">
                      {c.dailyBudgetEur != null
                        ? `${eur(c.dailyBudgetEur)}/j`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-white hidden md:table-cell">
                      {eur(c.spentEur)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-indigo-400 hidden sm:table-cell">
                      {eur(c.revenueEur)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {roas(c.revenueEur, c.spentEur)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-white hidden lg:table-cell">
                      {c.conversions}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums text-zinc-500 hidden md:table-cell">
                      {c.pushedAt
                        ? PUSHED_DATE.format(new Date(c.pushedAt))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {c.storeSlug ? (
                          <AdminActionMenu
                            ariaLabel={`Actions pour la campagne ${c.hook ?? c.id}`}
                            actions={[
                              {
                                label: "Analytics du store",
                                href: `/admin/stores/${c.storeSlug}/analytics`,
                              },
                              {
                                label: "Voir la landing",
                                href: `/shop/${c.storeSlug}`,
                              },
                            ]}
                          />
                        ) : (
                          <span className="text-zinc-500">—</span>
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
  );
}
