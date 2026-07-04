import { getDbRead } from '@/lib/db';

/**
 * Cross-store historical performance aggregation for the research copilot.
 *
 * `getCampaignPerformance()` (./performance.ts) is scoped to ONE store and
 * only consumed by the Super Agent's `ads_performance` tool AFTER a store
 * exists. That means every new store is proposed "blind": the research
 * copilot never sees which (niche, template, design preset) combinations
 * historically converted well on THIS platform.
 *
 * This module closes that loop with a fail-soft, opt-in aggregate: group
 * past campaigns by store niche + template + design_preset, compute mean
 * ROAS/spend/conversions per group, and surface a small ranked summary the
 * research copilot can weigh (never blindly follow — sample sizes are
 * tiny on a young platform).
 *
 * Niche is free text (`dropship_stores.niche`, see infra/postgres/002_stores.sql)
 * — there is no fixed taxonomy table to join against. We normalize
 * (trim + lowercase) before grouping, which is enough to collapse exact
 * repeats without over-engineering a fuzzy-matching layer this platform
 * doesn't need yet.
 */

export interface HistoricalPerformanceGroup {
  niche: string;
  template: string;
  designPreset: string | null;
  campaignCount: number;
  storeCount: number;
  avgRoas: number;
  avgSpendEur: number;
  totalConversions: number;
}

export interface PerformanceSummary {
  groups: HistoricalPerformanceGroup[];
  /** Total campaigns considered across all groups (post-filtering). */
  totalCampaigns: number;
}

interface QueryRow {
  niche: string;
  template: string;
  design_preset: string | null;
  campaign_count: string | number;
  store_count: string | number;
  total_spend_eur: string | number | null;
  total_revenue_eur: string | number | null;
  total_conversions: string | number;
}

// Below this many campaigns in a group, ROAS is noise — we still return the
// group (young platform, data is scarce by definition) but the caller must
// caveat it. See `formatHistoricalPerformanceForPrompt()`.
const LOW_SAMPLE_THRESHOLD = 5;
const MAX_GROUPS_RETURNED = 5;

/**
 * Aggregates `dropship_ad_campaigns` joined to `dropship_stores`, grouped by
 * (niche, template, design_preset). Filters to campaigns that are actually
 * live signal (status active/paused, i.e. not still draft/queued/error) and
 * that have accrued measurable spend.
 *
 * Fail-soft by design: any DB error, or an empty result set, resolves to
 * `null` rather than throwing — this must never block the research flow,
 * especially on a fresh platform with zero campaign history.
 */
export async function getHistoricalPerformanceSummary(): Promise<PerformanceSummary | null> {
  try {
    const db = getDbRead();
    const { rows } = await db.query<QueryRow>(
      `WITH campaign_spend AS (
         SELECT
           c.id,
           c.store_id,
           s.template,
           s.design_preset,
           s.niche,
           COALESCE(c.daily_budget_eur, 0) *
             GREATEST(1, CEIL(EXTRACT(EPOCH FROM (now() - c.pushed_at)) / 86400.0))
             AS spend_eur,
           COALESCE(SUM(f.value_minor) FILTER (WHERE f.event_name = 'purchase'), 0) / 100.0
             AS revenue_eur,
           COUNT(f.id) FILTER (WHERE f.event_name = 'purchase') AS conversions
         FROM dropship_ad_campaigns c
         JOIN dropship_stores s ON s.id = c.store_id
         LEFT JOIN dropship_ad_variants v ON v.id = c.variant_id
         LEFT JOIN dropship_funnel_events f
                ON f.utm_campaign = 'dsv-' || s.slug || '-' || c.variant_id::text
               AND f.created_at > c.created_at
         WHERE c.status IN ('active', 'paused')
           AND c.pushed_at IS NOT NULL
           AND COALESCE(c.daily_budget_eur, 0) > 0
         GROUP BY c.id, c.store_id, s.template, s.design_preset,
                  s.niche, c.daily_budget_eur, c.pushed_at
       )
       SELECT
         lower(trim(niche))                AS niche,
         COALESCE(template, 'auto')        AS template,
         design_preset                     AS design_preset,
         COUNT(*)                          AS campaign_count,
         COUNT(DISTINCT store_id)          AS store_count,
         SUM(spend_eur)                    AS total_spend_eur,
         SUM(revenue_eur)                  AS total_revenue_eur,
         SUM(conversions)                  AS total_conversions
       FROM campaign_spend
       WHERE spend_eur > 0
       GROUP BY lower(trim(niche)), COALESCE(template, 'auto'), design_preset
       ORDER BY (SUM(revenue_eur) / NULLIF(SUM(spend_eur), 0)) DESC NULLS LAST
       LIMIT $1`,
      [MAX_GROUPS_RETURNED],
    );

    if (rows.length === 0) return null;

    const groups: HistoricalPerformanceGroup[] = rows.map((r) => {
      const campaignCount = Number(r.campaign_count) || 0;
      const totalSpendEur = Number(r.total_spend_eur) || 0;
      const totalRevenueEur = Number(r.total_revenue_eur) || 0;
      return {
        niche: r.niche,
        template: r.template,
        designPreset: r.design_preset,
        campaignCount,
        storeCount: Number(r.store_count) || 0,
        avgRoas: totalSpendEur > 0 ? totalRevenueEur / totalSpendEur : 0,
        avgSpendEur: campaignCount > 0 ? totalSpendEur / campaignCount : 0,
        totalConversions: Number(r.total_conversions) || 0,
      };
    });

    const totalCampaigns = groups.reduce((sum, g) => sum + g.campaignCount, 0);

    return { groups, totalCampaigns };
  } catch {
    // Fail-soft: missing columns on an older schema, DB hiccup, or genuinely
    // no data yet (fresh platform, or all stores just wiped) — never throw,
    // never block the research copilot's flow.
    return null;
  }
}

/**
 * Renders the summary as an advisory (not directive) prompt block for the
 * research copilot's system prompt. Returns '' when there is nothing to
 * show — callers should omit the section entirely rather than injecting an
 * awkward "no data available" message.
 */
export function formatHistoricalPerformanceForPrompt(summary: PerformanceSummary | null): string {
  if (!summary || summary.groups.length === 0) return '';

  const lines = summary.groups.map((g) => {
    const presetLabel = g.designPreset ? `preset ${g.designPreset}` : 'preset non défini';
    const caveat = g.campaignCount < LOW_SAMPLE_THRESHOLD
      ? ` (échantillon faible, N=${g.campaignCount} — à pondérer avec prudence)`
      : ` (N=${g.campaignCount} campagnes, ${g.storeCount} store${g.storeCount > 1 ? 's' : ''})`;
    return `  - niche "${g.niche}", template ${g.template}, ${presetLabel} : ROAS moyen ${g.avgRoas.toFixed(2)}, dépense moyenne ${g.avgSpendEur.toFixed(0)}€/campagne${caveat}`;
  });

  return [
    '=== Signal historique plateforme (advisory, PAS directif) ===',
    `Basé sur ${summary.totalCampaigns} campagne${summary.totalCampaigns > 1 ? 's' : ''} passée${summary.totalCampaigns > 1 ? 's' : ''} sur ce répertoire de stores, voici les combinaisons (niche, template, preset) qui ont le mieux performé :`,
    ...lines,
    'Ce signal est à PONDÉRER, pas à suivre aveuglément : l\'échantillon est probablement petit (plateforme jeune), le contexte marché a pu changer, et une niche différente peut être meilleure aujourd\'hui même sans historique. Ne rejette jamais une bonne opportunité au seul motif qu\'elle n\'a pas d\'historique.',
    '=== Fin signal historique ===',
  ].join('\n');
}
