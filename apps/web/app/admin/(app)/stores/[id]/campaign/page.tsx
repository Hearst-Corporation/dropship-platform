import { notFound } from 'next/navigation';
import { MegaphoneIcon } from '@heroicons/react/24/outline';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { loadStoreReport } from '@/lib/agent/store-report';
import type { GoogleAdsPlan } from '@/lib/agent/ads-planner';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
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
import { AdminSection } from '@/components/admin/AdminSection';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { CampaignCharts } from './CampaignCharts';

export const dynamic = 'force-dynamic';

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
  channel: string;
  headline: string | null;
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft non envoyé',
  queued: 'En file d attente',
  live: 'En ligne',
  paused: 'En pause',
  error: 'Erreur de push',
};

interface Phase {
  id: string;
  period: string;
  title: string;
  actions: string[];
  deliverable: string;
  planNotes: Array<{ label: string; items: string[] }>;
}

/**
 * Build the 4-phase launch timeline and fold the plan's nextSteps,
 * trackingNotes and policyRisks into the matching phases:
 * risks -> validation, tracking notes -> tracking, remaining steps spread
 * validation / tracking / launch / optimisation in order.
 */
function buildPhases(plan: GoogleAdsPlan): Phase[] {
  const steps = plan.nextSteps;
  return [
    {
      id: 'validation',
      period: 'Semaine 1',
      title: 'Validation',
      actions: [
        'Valider le plan de campagne et les créatives (titres, descriptions).',
        'Créer la campagne en pause dans Google Ads, sans aucune diffusion.',
        ...(steps[0] ? [steps[0]] : []),
      ],
      deliverable: 'Campagne draft prête dans Google Ads, en pause.',
      planNotes: plan.policyRisks.length
        ? [{ label: 'Points de vigilance policy', items: plan.policyRisks }]
        : [],
    },
    {
      id: 'tracking',
      period: 'Semaine 1 à 2',
      title: 'Tracking',
      actions: [
        'Brancher le tag de conversion Google Ads sur le storefront.',
        'Réaliser un achat test et vérifier que la conversion remonte.',
        'Contrôler les UTM sur toutes les URL finales.',
        ...(steps[1] ? [steps[1]] : []),
      ],
      deliverable: 'Conversion vérifiée de bout en bout, UTM propres.',
      planNotes: plan.trackingNotes.length
        ? [{ label: 'Notes tracking du plan', items: plan.trackingNotes }]
        : [],
    },
    {
      id: 'launch',
      period: 'Semaine 2 à 3',
      title: 'Lancement',
      actions: [
        `Activer la campagne au budget proposé de ${plan.dailyBudgetEur.toLocaleString('fr-FR')} € par jour.`,
        `Diffusion limitée aux pays ciblés: ${plan.countries.join(', ')}.`,
        ...(steps[2] ? [steps[2]] : []),
      ],
      deliverable: 'Campagne active qui dépense sur les pays ciblés.',
      planNotes: [],
    },
    {
      id: 'optimisation',
      period: 'Semaine 3 à 4 et plus',
      title: 'Optimisation',
      actions: [
        'Revue des termes de recherche à J+3 après activation.',
        'Ajout des mots-clés négatifs sur les requêtes hors cible.',
        'Ajustement des enchères selon le coût par conversion observé.',
        ...steps.slice(3),
      ],
      deliverable: 'Premier cycle d optimisation documenté, budget maîtrisé.',
      planNotes: [],
    },
  ];
}

export default async function StoreCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  const [storeRes, campaignRes, report] = await Promise.all([
    db.query<StoreRow>(
      `SELECT id, slug, name FROM dropship_stores WHERE id = $1 LIMIT 1`,
      [storeId],
    ),
    db.query<CampaignRow>(
      `SELECT c.id, c.status, c.daily_budget_eur, c.created_at, c.channel, v.headline
         FROM dropship_ad_campaigns c
         JOIN dropship_ad_variants v ON v.id = c.variant_id
        WHERE c.store_id = $1
        ORDER BY c.created_at DESC
        LIMIT 1`,
      [storeId],
    ),
    loadStoreReport(db, storeId),
  ]);

  const store = storeRes.rows[0];
  if (!store) notFound();

  const plan = report?.adsPlan ?? null;
  const campaign = campaignRes.rows[0] ?? null;

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
            action={<Button href="/admin/stores/new">Créer un store via l&apos;agent</Button>}
          />
        </AdminSection>
      </div>
    );
  }

  const phases = buildPhases(plan);
  const campaignStatus = campaign?.status ?? 'draft';
  const campaignStatusLabel = CAMPAIGN_STATUS_LABEL[campaignStatus] ?? campaignStatus;
  const dailyBudget = plan.dailyBudgetEur;
  const monthlyBudget = dailyBudget * 30;
  const stagedAt = campaign
    ? new Date(campaign.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Text className="text-xs/5 uppercase tracking-wide">Campagne Google Ads</Text>
          <Heading className="mt-1">{plan.campaignName}</Heading>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AdminBadge status={campaignStatus}>{campaignStatusLabel}</AdminBadge>
            {plan.source === 'openai' ? (
              <Badge color="indigo">Généré par IA</Badge>
            ) : (
              <Badge color="zinc">Plan de secours</Badge>
            )}
            <Badge color="zinc">{plan.countries.join(' · ')}</Badge>
          </div>
          <Text className="mt-3 max-w-3xl">{plan.objective}</Text>
        </div>
      </div>

      <AdminStatsGrid cols={4}>
        <AdminStatCard
          label="Budget / jour"
          value={`${dailyBudget.toLocaleString('fr-FR')} €`}
          tone="positive"
          hint="Proposé par le plan, campagne créée en pause"
        />
        <AdminStatCard
          label="Budget sur 30 jours"
          value={`${monthlyBudget.toLocaleString('fr-FR')} €`}
          hint="Si le budget quotidien est dépensé en entier"
        />
        <AdminStatCard
          label="Pays ciblés"
          value={plan.countries.length.toString()}
          hint={plan.countries.join(', ')}
        />
        <AdminStatCard
          label="Mots-clés"
          value={plan.keywords.length.toString()}
          hint={`${plan.negativeKeywords.length} négatifs prévus`}
        />
      </AdminStatsGrid>

      <AdminSection title="Ciblage et diffusion" description="Ce que le plan propose avant tout envoi vers Google Ads.">
        <DescriptionList>
          <DescriptionTerm>Audience</DescriptionTerm>
          <DescriptionDetails>{plan.audience}</DescriptionDetails>
          <DescriptionTerm>Landing page</DescriptionTerm>
          <DescriptionDetails className="break-all">{plan.landingPage}</DescriptionDetails>
          {campaign ? (
            <>
              <DescriptionTerm>Draft en base</DescriptionTerm>
              <DescriptionDetails>
                Stagé le {stagedAt} sur le canal {campaign.channel}
                {campaign.headline ? <> avec le titre principal «{campaign.headline}»</> : null}.
              </DescriptionDetails>
            </>
          ) : (
            <>
              <DescriptionTerm>Draft en base</DescriptionTerm>
              <DescriptionDetails>
                Aucune ligne stagée dans les tables de campagne pour ce store. Le plan reste consultable ici.
              </DescriptionDetails>
            </>
          )}
        </DescriptionList>
      </AdminSection>

      {/* Déroulé pédagogique */}
      <AdminSection
        title="Comment ça va se passer"
        description="Le déroulé du lancement en 4 phases, du plan validé à la campagne optimisée. Rien n'est envoyé à Google sans validation."
      >
        <ol className="relative space-y-8 border-l border-zinc-950/10 pl-6 dark:border-white/10">
          {phases.map((phase, index) => (
            <li key={phase.id} className="relative">
              <span
                aria-hidden
                className="absolute -left-[31px] top-0.5 flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white dark:bg-indigo-500"
              >
                {index + 1}
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <Subheading level={3}>{phase.title}</Subheading>
                <Badge color="zinc">{phase.period}</Badge>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm/6 text-zinc-600 dark:text-zinc-300">
                {phase.actions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
              {phase.planNotes.map((note) => (
                <div
                  key={note.label}
                  className="mt-3 rounded-lg border border-zinc-950/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5"
                >
                  <p className="text-xs/5 font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {note.label}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm/6 text-zinc-600 dark:text-zinc-300">
                    {note.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="mt-2 text-xs/5 text-zinc-500 dark:text-zinc-400">
                Livrable: {phase.deliverable}
              </p>
            </li>
          ))}
        </ol>
      </AdminSection>

      {/* Calendrier */}
      <div className="space-y-3">
        <div>
          <Subheading>Calendrier de lancement</Subheading>
          <Text className="mt-1">Les 4 phases résumées, avec la période et le livrable attendu.</Text>
        </div>
        <AdminDataTable minWidth="min-w-2xl">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Phase</TableHeader>
                <TableHeader>Période</TableHeader>
                <TableHeader>Actions</TableHeader>
                <TableHeader>Livrable</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {phases.map((phase) => (
                <TableRow key={phase.id}>
                  <TableCell className="font-medium">{phase.title}</TableCell>
                  <TableCell className="text-zinc-500 dark:text-zinc-400">{phase.period}</TableCell>
                  <TableCell className="whitespace-normal text-zinc-600 dark:text-zinc-300">
                    {phase.actions.join(' ')}
                  </TableCell>
                  <TableCell className="whitespace-normal text-zinc-500 dark:text-zinc-400">
                    {phase.deliverable}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDataTable>
      </div>

      {/* Projections */}
      <AdminSection
        title="Projections sur 30 jours"
        description="Projections calculées depuis le budget du plan avec des hypothèses affichées sous chaque graphe. Aucune donnée réelle tant que la campagne n'est pas active."
      >
        <CampaignCharts dailyBudgetEur={dailyBudget} countries={plan.countries} />
      </AdminSection>

      {/* Mots-clés & annonces */}
      <AdminSection
        title="Mots-clés et annonces"
        description="Le contenu RSA proposé par le plan: mots-clés d'intention, négatifs, titres et descriptions."
      >
        <div className="space-y-6">
          <div>
            <Subheading level={3}>Mots-clés ({plan.keywords.length})</Subheading>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.keywords.map((kw) => (
                <Badge key={kw} color="indigo">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Subheading level={3}>Mots-clés négatifs ({plan.negativeKeywords.length})</Subheading>
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
                    className="rounded-lg border border-zinc-950/10 bg-zinc-50 px-3 py-2 text-sm/6 text-zinc-950 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Subheading level={3}>Descriptions (max 90 caractères)</Subheading>
              <ul className="mt-2 space-y-1.5">
                {plan.descriptions.slice(0, 3).map((d, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-zinc-950/10 bg-zinc-50 px-3 py-2 text-sm/6 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
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
