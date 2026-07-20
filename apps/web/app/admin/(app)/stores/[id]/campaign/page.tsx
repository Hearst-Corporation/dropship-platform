import { notFound } from "next/navigation";
import { MegaphoneIcon } from "@heroicons/react/24/outline";
import { getDbRead } from "@/lib/db";
import { resolveStoreId } from "@/lib/resolve-store";
import { loadStoreReport } from "@/lib/agent/store-report";
import { getChannelConnections } from "@/lib/ads/all-campaigns";
import { Heading, Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
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
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  formatEur as eur,
  formatNumberFr as fr,
  formatLongDate as frDate,
  formatLongDateTime as frDateTime,
} from "@/lib/format";
import {
  GoogleAdsLogo,
  InstagramLogo,
  PLATFORM_BRAND_COLORS,
  TikTokLogo,
} from "./PlatformLogos";
import { ValidateButton } from "./ValidateButton";
import { PushCampaignButton } from "./PushCampaignButton";
import { PlatformSplitDonut, KpiComparisonChart } from "./CampaignChartsLazy";

export const dynamic = "force-dynamic";

// ── Hypothèses et règles déterministes (affichées telles quelles) ─────────────

/** Répartition du budget quotidien: Google 50%, Instagram 30%, TikTok 20%. */
const SPLIT_RULE = { google: 0.5, instagram: 0.3, tiktok: 0.2 } as const;
const CPC_EUR = 0.45;
const CVR = 0.025;

/**
 * Couleurs de marque des plateformes, autorisées sur cette page uniquement
 * (exception opérateur à la règle single-accent). L'admin est rendu en dark
 * forcé, donc TikTok (#010101) est affiché en blanc dans le graphe.
 */
const PLATFORM_CHART_COLORS = PLATFORM_BRAND_COLORS;

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft non envoyé",
  queued: "En file d attente",
  live: "En ligne",
  paused: "En pause",
  error: "Erreur de push",
};

const MILESTONES = [
  {
    day: "J1",
    action:
      "Activation des campagnes au budget validé, diffusion France uniquement.",
    criteria: "Les campagnes sont actives et dépensent au budget du plan.",
  },
  {
    day: "J2 à J3",
    action: "Vérification du tracking et lecture des premières données.",
    criteria:
      "Les événements view_content et purchase remontent avec les bons UTM.",
  },
  {
    day: "J7",
    action:
      "Revue des requêtes, ajout des mots-clés négatifs, coupe des annonces faibles.",
    criteria:
      "Liste de négatifs mise à jour, annonces sous la moyenne mises en pause.",
  },
  {
    day: "J14",
    action: "Scaling de 20% du budget si le ROAS dépasse le seuil cible.",
    criteria:
      "ROAS au-dessus du seuil sur 7 jours glissants avant toute hausse.",
  },
  {
    day: "J30",
    action: "Bilan complet et réallocation du budget entre plateformes.",
    criteria: "Rapport 30 jours produit, nouvelle répartition décidée.",
  },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreRow {
  id: string;
  slug: string;
  name: string;
}

interface CampaignRow {
  id: string;
  status: string;
  daily_budget_eur: string | number | null;
  created_at: string;
  pushed_at: string | null;
  channel: string;
  headline: string | null;
}

interface ValidationState {
  budgetValidatedAt?: string;
  calendarValidatedAt?: string;
}

interface FunnelRealsRow {
  traffic: string | number;
  purchases: string | number;
  revenue_cents: string | number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** ROAS en multiplicateur, ex. "x2,4". */
function roasFmt(n: number): string {
  return `x${fr(n)}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StoreCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  const [storeRes, campaignRes, report, validationRes] = await Promise.all([
    db.query<StoreRow>(
      `SELECT id, slug, name FROM dropship_stores WHERE id = $1 LIMIT 1`,
      [storeId],
    ),
    db.query<CampaignRow>(
      `SELECT c.id, c.status, c.daily_budget_eur, c.created_at, c.pushed_at, c.channel, v.headline
         FROM dropship_ad_campaigns c
         JOIN dropship_ad_variants v ON v.id = c.variant_id
        WHERE c.store_id = $1
        ORDER BY c.created_at DESC
        LIMIT 1`,
      [storeId],
    ),
    loadStoreReport(db, storeId),
    db.query<{ value: string }>(
      `SELECT value FROM platform_settings WHERE key = $1 LIMIT 1`,
      [`campaign_validation:${storeId}`],
    ),
  ]);

  const store = storeRes.rows[0];
  if (!store) notFound();

  const plan = report?.adsPlan ?? null;
  const campaign = campaignRes.rows[0] ?? null;

  // État vide legacy: pas de plan dans le rapport de run.
  if (!plan) {
    return (
      <div className="space-y-8">
        <div className="min-w-0">
          <Text className="text-xs/5 uppercase tracking-wide">Campagne</Text>
          <Heading className="mt-1">{store.name}</Heading>
        </div>
        <AdminSection>
          <AdminEmptyState
            icon={MegaphoneIcon}
            title="Aucun plan de campagne pour ce store."
            description="Relance une création via l'agent pour en générer un."
            action={
              <Button href="/admin/stores/new">
                Créer un store via l&apos;agent
              </Button>
            }
          />
        </AdminSection>
      </div>
    );
  }

  // ── Validations persistées (platform_settings, sans migration) ─────────────
  let validation: ValidationState = {};
  const rawValidation = validationRes.rows[0]?.value;
  if (rawValidation) {
    try {
      const parsed = JSON.parse(rawValidation) as unknown;
      if (parsed && typeof parsed === "object")
        validation = parsed as ValidationState;
    } catch {
      // Valeur illisible: on repart des boutons.
    }
  }

  // ── Cibles de performance (bloc optionnel, absent sur les vieux plans) ─────
  const targets = plan.performanceTargets ?? null;
  const strategyNotes = plan.strategyNotes ?? [];

  // ── Budget et répartition plateforme (France uniquement) ───────────────────
  const dailyBudget = plan.dailyBudgetEur;
  const monthlyBudget = dailyBudget * 30;
  const googleDaily = Math.round(dailyBudget * SPLIT_RULE.google * 100) / 100;
  const instagramDaily =
    Math.round(dailyBudget * SPLIT_RULE.instagram * 100) / 100;
  const tiktokDaily =
    Math.round((dailyBudget - googleDaily - instagramDaily) * 100) / 100;
  const otherZones = plan.countries.filter((c) => c.toUpperCase() !== "FR");

  const connections = getChannelConnections();
  const isConnected = (channel: "google" | "meta" | "tiktok") =>
    connections.find((c) => c.channel === channel)?.connected ?? false;

  const platforms = [
    {
      id: "google",
      name: "Google Ads",
      Logo: GoogleAdsLogo,
      dailyEur: googleDaily,
      pct: Math.round(SPLIT_RULE.google * 100),
      connected: isConnected("google"),
      hasDraft: Boolean(campaign),
    },
    {
      id: "instagram",
      name: "Instagram",
      Logo: InstagramLogo,
      dailyEur: instagramDaily,
      pct: Math.round(SPLIT_RULE.instagram * 100),
      connected: isConnected("meta"),
      hasDraft: false,
    },
    {
      id: "tiktok",
      name: "TikTok",
      Logo: TikTokLogo,
      dailyEur: tiktokDaily,
      pct: Math.round(SPLIT_RULE.tiktok * 100),
      connected: isConnected("tiktok"),
      hasDraft: false,
    },
  ] as const;

  // ── Projeté vs réel depuis le lancement ─────────────────────────────────────
  const launched = Boolean(
    campaign &&
    (campaign.pushed_at ||
      campaign.status === "live" ||
      campaign.status === "paused"),
  );
  const sinceIso = campaign
    ? (campaign.pushed_at ?? campaign.created_at)
    : null;

  let daysElapsed = 0;
  let spendProjected = 0;
  let clicksProjected = 0;
  let convProjected = 0;
  let revenueProjected = 0;
  let realTraffic = 0;
  let realConversions = 0;
  let realRevenue = 0;

  if (launched && sinceIso) {
    daysElapsed = Math.max(
      1,
      Math.ceil((Date.now() - new Date(sinceIso).getTime()) / 86_400_000),
    );
    spendProjected = Math.round(dailyBudget * daysElapsed * 100) / 100;
    if (targets) {
      // Projections du bloc data du plan (calculées sur le catalogue réel).
      clicksProjected = Math.round(targets.expectedDailyClicks * daysElapsed);
      convProjected =
        Math.round(targets.expectedDailyConversions * daysElapsed * 10) / 10;
      revenueProjected =
        Math.round(targets.expectedDailyRevenueEur * daysElapsed * 100) / 100;
    } else {
      clicksProjected = Math.round(spendProjected / CPC_EUR);
      convProjected = Math.round(clicksProjected * CVR * 10) / 10;
    }

    const realsRes = await db.query<FunnelRealsRow>(
      `SELECT
         COUNT(*) FILTER (WHERE event_name = 'view_content')::int AS traffic,
         COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS purchases,
         COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase'), 0)::bigint AS revenue_cents
       FROM dropship_funnel_events
       WHERE store_slug = $1 AND created_at > $2`,
      [store.slug, sinceIso],
    );
    const reals = realsRes.rows[0];
    realTraffic = Number(reals?.traffic) || 0;
    realConversions = Number(reals?.purchases) || 0;
    realRevenue = (Number(reals?.revenue_cents) || 0) / 100;
  }

  const kpiChartData = [
    { metric: "Trafic (clics)", projete: clicksProjected, reel: realTraffic },
    { metric: "Conversions", projete: convProjected, reel: realConversions },
  ];

  const kpiRows = [
    {
      label: "Dépense publicitaire",
      projete: eur(spendProjected),
      reel: "n/d",
    },
    {
      label: "Trafic (clics)",
      projete: clicksProjected.toLocaleString("fr-FR"),
      reel: realTraffic.toLocaleString("fr-FR"),
    },
    {
      label: "Conversions",
      projete: convProjected.toLocaleString("fr-FR"),
      reel: realConversions.toLocaleString("fr-FR"),
    },
    {
      label: "Revenus",
      projete: targets ? eur(revenueProjected) : "n/d",
      reel: eur(realRevenue),
    },
  ];

  // Hypothèses affichées: celles du plan quand elles existent, sinon locales.
  const cpcAssumption = targets?.assumedCpcEur ?? CPC_EUR;
  const cvrAssumptionPct = targets?.assumedCvrPct ?? CVR * 100;

  const campaignStatus = campaign?.status ?? "draft";
  const campaignStatusLabel =
    CAMPAIGN_STATUS_LABEL[campaignStatus] ?? campaignStatus;

  return (
    <div className="space-y-8">
      {/* En-tête compact */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Text className="text-xs/5 uppercase tracking-wide">Campagne</Text>
          <Heading className="mt-1">{plan.campaignName}</Heading>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AdminBadge status={campaignStatus}>
              {campaignStatusLabel}
            </AdminBadge>
            {plan.source === "openai" ? (
              <Badge color="indigo">Généré par IA</Badge>
            ) : (
              <Badge color="zinc">Plan de secours</Badge>
            )}
            <Badge color="zinc">Zone: France</Badge>
          </div>
          {otherZones.length > 0 ? (
            <p className="mt-2 text-xs/5 text-zinc-500 text-zinc-400">
              Autres zones ({otherZones.join(", ")}) : phase ultérieure.
            </p>
          ) : null}
        </div>
        <AdminStatsGrid cols={2} className="shrink-0">
          <AdminStatCard
            label="Budget quotidien"
            value={eur(dailyBudget)}
            hint={`${eur(monthlyBudget)} sur 30 jours`}
          />
        </AdminStatsGrid>
      </div>

      {/* Plan média par plateforme */}
      <AdminSection
        title="Plan média par plateforme"
        description="Répartition du budget quotidien sur les trois plateformes de diffusion. France uniquement pour cette phase."
      >
        <AdminStatsGrid cols={3}>
          {platforms.map((p) => (
            <AdminStatCard
              key={p.id}
              label={p.name}
              value={
                <>
                  {eur(p.dailyEur)}
                  <span className="ml-1 text-sm font-normal opacity-80">
                    / jour
                  </span>
                </>
              }
              hint={`${p.pct}% du budget · ${p.connected ? "Connecté" : "À connecter"}${p.hasDraft ? " · Draft stagé" : ""}`}
            />
          ))}
        </AdminStatsGrid>
      </AdminSection>

      {/* Répartition du budget */}
      <AdminSection
        title="Répartition du budget quotidien"
        description="Règle appliquée: Google Ads 50%, Instagram 30%, TikTok 20% du budget quotidien du plan."
      >
        <PlatformSplitDonut
          totalDailyEur={dailyBudget}
          splits={platforms.map((p) => ({
            name: p.name,
            color: PLATFORM_CHART_COLORS[p.id],
            pct: p.pct,
            dailyEur: p.dailyEur,
          }))}
        />
      </AdminSection>

      {/* Cibles de performance (bloc data, optionnel sur les vieux plans) */}
      {targets ? (
        <AdminSection
          title="Cibles de performance"
          description={`Calculées sur la marge réelle du catalogue: prix moyen ${eur(targets.avgPriceEur)}, marge moyenne ${eur(targets.avgMarginEur)} (${fr(targets.avgMarginPct)}%).`}
        >
          <div className="space-y-6">
            <AdminStatsGrid cols={3}>
              <AdminStatCard
                label="ROAS break-even"
                value={roasFmt(targets.breakEvenRoas)}
                hint="Seuil de rentabilité calculé sur la marge réelle du catalogue"
              />
              <AdminStatCard
                label="ROAS cible"
                value={roasFmt(targets.targetRoas)}
                tone="positive"
                hint="Objectif de pilotage, au-dessus du seuil de rentabilité"
              />
              <AdminStatCard
                label="CPA max"
                value={eur(targets.maxCpaEur)}
                hint="Coût par acquisition à ne pas dépasser"
              />
              <AdminStatCard
                label="Conversions / jour attendues"
                value={fr(targets.expectedDailyConversions)}
                hint="Au budget quotidien du plan"
              />
              <AdminStatCard
                label="Revenus / jour attendus"
                value={eur(targets.expectedDailyRevenueEur)}
                hint="Conversions attendues x prix moyen"
              />
              <AdminStatCard
                label="ROAS projeté"
                value={roasFmt(targets.projectedRoas)}
                tone={
                  targets.projectedRoas >= targets.breakEvenRoas
                    ? "positive"
                    : "default"
                }
                hint="Revenus attendus / budget quotidien"
              />
            </AdminStatsGrid>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-admin-border bg-admin-surface-inset p-5">
                <Subheading level={3}>Règle de coupe</Subheading>
                <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-white">
                  {eur(targets.killThreshold.spendEurWithoutSale)}
                  <span className="ml-1 text-sm font-normal text-zinc-500 text-zinc-400">
                    dépensés sans vente
                  </span>
                </p>
                <p className="mt-2 text-sm/6 text-zinc-400">
                  {targets.killThreshold.description}
                </p>
              </div>
              <div className="rounded-xl border border-admin-border bg-admin-surface-inset p-5">
                <Subheading level={3}>Règle de scaling</Subheading>
                <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-white">
                  +{fr(targets.scaleRule.budgetStepPct)}%
                  <span className="ml-1 text-sm font-normal text-zinc-500 text-zinc-400">
                    par palier, plancher ROAS{" "}
                    {roasFmt(targets.scaleRule.roasFloor)}
                  </span>
                </p>
                <p className="mt-2 text-sm/6 text-zinc-400">
                  {targets.scaleRule.description}
                </p>
              </div>
            </div>
            <p className="text-xs/5 text-zinc-500 text-zinc-400">
              Hypothèses: CPC moyen {fr(targets.assumedCpcEur)} €, taux de
              conversion {fr(targets.assumedCvrPct)}%.
            </p>
          </div>
        </AdminSection>
      ) : null}

      {/* Notes du stratège (optionnel) */}
      {strategyNotes.length > 0 ? (
        <AdminSection
          title="Notes du stratège"
          description="Recommandations du modèle pour le pilotage de la campagne."
        >
          <ul className="list-disc space-y-1.5 pl-4 text-sm/6 text-zinc-400">
            {strategyNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </AdminSection>
      ) : null}

      <AdminSection
        title="Calendrier de lancement"
        description="La publicité démarre au jour 1, dès que le site est terminé. Pas de phase de mise en place du site."
        flush
      >
        <AdminDataTable fixedLayout>
          <Table dense bleed>
            <colgroup>
              <col style={{ width: "4.5rem" }} />
              <col />
              <col />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableHeader>Jour</TableHeader>
                <TableHeader>Action</TableHeader>
                <TableHeader className="hidden sm:table-cell">
                  Critère de validation
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {MILESTONES.map((m) => (
                <TableRow key={m.day}>
                  <TableCell className="font-medium tabular-nums">
                    {m.day}
                  </TableCell>
                  <TableCell className="whitespace-normal text-zinc-400">
                    {m.action}
                  </TableCell>
                  <TableCell className="whitespace-normal text-zinc-500 text-zinc-400 hidden sm:table-cell">
                    {m.criteria}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDataTable>
      </AdminSection>

      {/* Validations opérateur */}
      <AdminSection
        title="Validations"
        description="Deux validations opérateur avant activation, persistées côté plateforme."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-admin-border bg-admin-surface-inset p-5">
            <Subheading level={3}>Validation du budget</Subheading>
            <DescriptionList className="mt-2">
              <DescriptionTerm>Budget / jour total</DescriptionTerm>
              <DescriptionDetails className="tabular-nums">
                {eur(dailyBudget)}
              </DescriptionDetails>
              <DescriptionTerm>Répartition</DescriptionTerm>
              <DescriptionDetails>
                Google Ads {eur(googleDaily)}, Instagram {eur(instagramDaily)},
                TikTok {eur(tiktokDaily)}
              </DescriptionDetails>
              <DescriptionTerm>Plafond 30 jours</DescriptionTerm>
              <DescriptionDetails className="tabular-nums">
                {eur(monthlyBudget)}
              </DescriptionDetails>
            </DescriptionList>
            <div className="mt-4">
              {validation.budgetValidatedAt ? (
                <Badge color="indigo">
                  Validé le {frDateTime(validation.budgetValidatedAt)}
                </Badge>
              ) : (
                <ValidateButton
                  storeId={storeId as string}
                  kind="budget"
                  label="Valider le budget"
                />
              )}
            </div>
          </div>
          <div className="flex flex-col rounded-xl border border-admin-border bg-admin-surface-inset p-5">
            <Subheading level={3}>Validation du calendrier</Subheading>
            <ul className="mt-2 space-y-1.5 text-sm/6 text-zinc-400">
              {MILESTONES.map((m) => (
                <li key={m.day} className="flex gap-2">
                  <span className="w-14 shrink-0 font-medium tabular-nums text-white">
                    {m.day}
                  </span>
                  <span className="min-w-0">{m.action}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              {validation.calendarValidatedAt ? (
                <Badge color="indigo">
                  Validé le {frDateTime(validation.calendarValidatedAt)}
                </Badge>
              ) : (
                <ValidateButton
                  storeId={storeId as string}
                  kind="calendar"
                  label="Valider le calendrier"
                />
              )}
            </div>
          </div>
        </div>
        {campaign && campaign.channel === "google" && campaign.status === "draft" ? (
          <div className="mt-4 flex flex-col rounded-xl border border-admin-border bg-admin-surface-inset p-5">
            <Subheading level={3}>Lancement Google Ads</Subheading>
            <Text className="mt-2 text-sm/6 text-zinc-400">
              Pousse la campagne draft vers Google Ads. Elle est créée en PAUSE
              (aucune dépense automatique) — active-la ensuite dans Google Ads
              après vérification.
            </Text>
            <div className="mt-4">
              <PushCampaignButton
                storeId={storeId as string}
                campaignId={campaign.id}
              />
            </div>
          </div>
        ) : null}
      </AdminSection>

      {/* Suivi projeté vs réel */}
      <AdminSection
        title="Suivi projeté vs réel"
        description={
          launched && sinceIso
            ? `Depuis le lancement du ${frDate(sinceIso)} (${daysElapsed} jour${daysElapsed > 1 ? "s" : ""}).`
            : campaign
              ? `Campagne stagée le ${frDate(campaign.created_at)}, pas encore diffusée.`
              : "Aucune campagne stagée en base pour l instant."
        }
      >
        <div className="space-y-6">
          {!launched ? (
            <div className="rounded-lg border border-admin-border bg-admin-surface-inset px-4 py-3 text-sm/6 text-zinc-400">
              En attente du lancement. Les données réelles apparaîtront dès la
              première diffusion.
            </div>
          ) : null}
          <AdminDataTable fixedLayout>
            <Table dense bleed>
              <colgroup>
                <col />
                <col style={{ width: "6rem" }} />
                <col style={{ width: "6rem" }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  <TableHeader>Indicateur</TableHeader>
                  <TableHeader className="text-right">Projeté</TableHeader>
                  <TableHeader className="text-right">Réel</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {kpiRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.projete}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.reel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
          <div>
            <KpiComparisonChart data={kpiChartData} />
            <p className="mt-2 text-xs/5 text-zinc-500 text-zinc-400">
              Hypothèses de projection{targets ? " (bloc data du plan)" : ""}:
              CPC moyen {fr(cpcAssumption)} €, taux de conversion{" "}
              {fr(cvrAssumptionPct)}%. n/d: disponible après intégration des
              rapports de dépense des plateformes.
            </p>
          </div>
        </div>
      </AdminSection>

      {/* Mots-clés & annonces RSA */}
      <AdminSection
        title="Mots-clés et annonces"
        description="Le contenu RSA proposé par le plan: mots-clés d'intention, négatifs, titres et descriptions."
      >
        <div className="space-y-6">
          <div>
            <Subheading level={3}>
              Mots-clés ({plan.keywords.length})
            </Subheading>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.keywords.map((kw) => (
                <Badge key={kw} color="indigo">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Subheading level={3}>
              Mots-clés négatifs ({plan.negativeKeywords.length})
            </Subheading>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.negativeKeywords.map((kw) => (
                <Badge key={kw} color="zinc">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <Subheading level={3}>Titres (max 30 caractères)</Subheading>
              <ul className="mt-2 space-y-1.5">
                {plan.headlines.slice(0, 5).map((h, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-admin-border bg-admin-surface-inset px-3 py-2 text-sm/6 text-white"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Subheading level={3}>
                Descriptions (max 90 caractères)
              </Subheading>
              <ul className="mt-2 space-y-1.5">
                {plan.descriptions.slice(0, 3).map((d, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-admin-border bg-admin-surface-inset px-3 py-2 text-sm/6 text-zinc-400"
                  >
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}
