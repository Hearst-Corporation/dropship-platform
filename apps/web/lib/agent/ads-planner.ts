/**
 * Google Ads launch plan generator for the store-creator pipeline.
 *
 * Produces a STAGED proposal (campaign, budget, audience, keywords, RSA copy,
 * policy risks, next steps) — nothing is pushed to Google. The plan is:
 *   1. returned to the caller for the run report (platform_settings), and
 *   2. optionally persisted as a `dropship_ad_variants` row (channel google)
 *      plus a `dropship_ad_campaigns` row with status 'draft', so it shows up
 *      in /admin/observability with the real campaign tables.
 *
 * Resilience: if the OpenAI call fails or returns an unusable payload, a
 * deterministic fallback plan is built from the products and clearly marked
 * `source: 'fallback'` — the pipeline never dies because ads planning failed.
 */

import { z } from 'zod';
import { trackedOpenAIMessage } from './openai-agent';
import { extractJson } from './json';

export interface AdsPlanInput {
  storeName: string;
  slug: string;
  niche: string;
  brief?: string | null;
  /** ISO country codes, e.g. ['FR', 'AE']. */
  markets: string[];
  language: 'fr' | 'en';
  landingUrl: string;
  products: Array<{ title: string; priceCents: number; costCents: number }>;
}

const GoogleAdsPlanSchema = z.object({
  campaignName: z.string().min(3).max(120),
  objective: z.string().min(3).max(200),
  countries: z.array(z.string().min(2).max(3)).min(1).max(8),
  dailyBudgetEur: z.number().min(1).max(500),
  audience: z.string().min(10).max(600),
  keywords: z.array(z.string().min(2).max(80)).min(5).max(30),
  negativeKeywords: z.array(z.string().min(2).max(80)).min(3).max(30),
  headlines: z.array(z.string().min(3).max(40)).min(5).max(15),
  descriptions: z.array(z.string().min(10).max(100)).min(3).max(6),
  landingPage: z.string().min(1).max(300),
  trackingNotes: z.array(z.string().min(5).max(300)).min(1).max(10),
  policyRisks: z.array(z.string().min(5).max(300)).min(1).max(10),
  nextSteps: z.array(z.string().min(5).max(300)).min(1).max(10),
  source: z.enum(['openai', 'fallback']),
});

export type GoogleAdsPlan = z.infer<typeof GoogleAdsPlanSchema>;

/** Strip stray years (19xx/20xx) — dated ad copy kills credibility over time. */
function stripAdYears(text: string): string {
  return text
    .replace(/\s*[·|–-]?\s*\b(19|20)\d{2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Google RSA hard limits: headlines 30 chars, descriptions 90 chars. */
function clampRsa(plan: GoogleAdsPlan): GoogleAdsPlan {
  return {
    ...plan,
    campaignName: stripAdYears(plan.campaignName) || plan.campaignName,
    headlines: plan.headlines.map((h) => stripAdYears(h).slice(0, 30).trim()).filter(Boolean).slice(0, 15),
    descriptions: plan.descriptions.map((d) => stripAdYears(d).slice(0, 90).trim()).filter(Boolean).slice(0, 6),
  };
}

/** Deterministic staged plan when the model is unavailable. Marked fallback. */
export function buildFallbackGoogleAdsPlan(input: AdsPlanInput): GoogleAdsPlan {
  const nicheWords = input.niche
    .toLowerCase()
    .split(/[^\p{L}0-9]+/u)
    .filter((w) => w.length > 2)
    .slice(0, 6);
  const topTitles = input.products.slice(0, 3).map((p) => p.title);
  const avgPrice = input.products.length
    ? input.products.reduce((s, p) => s + p.priceCents, 0) / input.products.length / 100
    : 29;
  const countries = input.markets.length ? input.markets : ['FR'];

  const plan: GoogleAdsPlan = {
    campaignName: `${input.storeName} · Lancement Search ${countries.join('+')}`,
    objective: 'Ventes en ligne (conversions achat) sur le storefront, phase de lancement.',
    countries,
    dailyBudgetEur: Math.max(15, Math.min(50, Math.round(avgPrice))),
    audience:
      'Adultes 25-54 intéressés par le bien-être à domicile et la beauté compacte, ' +
      'intention d achat (requêtes produit), appareils mobiles prioritaires.',
    keywords: [
      ...nicheWords.map((w) => `${w} maison`),
      ...topTitles.map((t) => t.toLowerCase().slice(0, 60)),
      'cadeau bien-être',
      'diffuseur huiles essentielles',
      'appareil beauté visage',
    ].slice(0, 15),
    negativeKeywords: ['gratuit', 'occasion', 'avis négatif', 'pas cher aliexpress', 'contrefaçon', 'emploi'],
    headlines: [
      `${input.storeName}`.slice(0, 30),
      'Bien-être à la maison',
      'Livraison suivie offerte',
      'Qualité premium vérifiée',
      'Commandez en 2 minutes',
    ],
    descriptions: [
      'Sélection bien-être et beauté compacte, testée et notée par notre studio.',
      'Paiement sécurisé, suivi de commande et support client réactif en français.',
      'Stock limité au lancement. Découvrez la collection et profitez des offres.',
    ],
    landingPage: input.landingUrl,
    trackingNotes: [
      'Conversion primaire: purchase (checkout complete) via Enhanced Conversions.',
      'UTM: utm_source=google, utm_medium=cpc, utm_campaign=dsv-' + input.slug + '.',
    ],
    policyRisks: [
      'Éviter tout claim santé ou thérapeutique (aromathérapie = bien-être, pas soin médical).',
      'Images produit sans logos tiers ni filigranes fournisseur.',
      'Prix et délais de livraison affichés sur la landing pour la conformité Google Merchant.',
    ],
    nextSteps: [
      'Valider le plan puis créer la campagne en pause dans Google Ads.',
      'Brancher le tag de conversion et vérifier un achat test.',
      'Activer avec le budget/jour proposé, revue des requêtes à J+3.',
    ],
    source: 'fallback',
  };
  return clampRsa(plan);
}

/**
 * Generate the Google Ads launch plan with GPT-4.1 (JSON mode). Retries the
 * parse once, then falls back to the deterministic plan. Never throws.
 */
export async function generateGoogleAdsPlan(input: AdsPlanInput): Promise<GoogleAdsPlan> {
  const productLines = input.products
    .slice(0, 12)
    .map((p) => `- ${p.title} · prix ${(p.priceCents / 100).toFixed(2)}€ · coût ${(p.costCents / 100).toFixed(2)}€`)
    .join('\n');

  const langNote = input.language === 'fr' ? 'Écris tout le contenu en français.' : 'Write all content in English.';

  const prompt = `You are a senior Google Ads strategist for premium dropshipping launches.

Store: "${input.storeName}" (${input.landingUrl})
Niche: "${input.niche}"
Target markets (ISO codes): ${input.markets.join(', ') || 'FR'}
${input.brief ? `Operator brief:\n${input.brief}\n` : ''}
Catalog:
${productLines || '- (catalog being generated)'}

${langNote}

Build ONE launch-ready Google Ads Search campaign proposal. Respect Google policy:
no medical/health claims, no regulated-product wording, no superlative guarantees.
Headlines max 30 characters each, descriptions max 90 characters each.
Never mention any year, date or vintage anywhere (campaign name, headlines,
descriptions) — the copy must read timeless.

Return ONLY a JSON object with EXACTLY these keys:
{
  "campaignName": "string",
  "objective": "string (conversion goal)",
  "countries": ["FR", "AE"],
  "dailyBudgetEur": 25,
  "audience": "string (who + intent + device note)",
  "keywords": ["10-15 buying-intent keywords"],
  "negativeKeywords": ["5-10 negatives"],
  "headlines": ["exactly 5 headlines, max 30 chars each"],
  "descriptions": ["exactly 3 descriptions, max 90 chars each"],
  "landingPage": "${input.landingUrl}",
  "trackingNotes": ["conversion + UTM setup notes"],
  "policyRisks": ["specific Google Ads policy risks for THIS catalog and how to avoid them"],
  "nextSteps": ["3-5 concrete launch steps"],
  "source": "openai"
}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text } = await trackedOpenAIMessage(
        { step: 'ads-plan' },
        [{ role: 'user', content: prompt }],
        { maxTokens: 2500, jsonMode: true },
      );
      const parsed = extractJson<Record<string, unknown>>(text);
      if (!parsed) continue;
      const candidate = GoogleAdsPlanSchema.safeParse({
        ...parsed,
        source: 'openai',
        landingPage: typeof parsed.landingPage === 'string' && parsed.landingPage ? parsed.landingPage : input.landingUrl,
      });
      if (candidate.success) return clampRsa(candidate.data);
      // Lenient second chance: coerce the common near-misses before giving up.
      const coerced = GoogleAdsPlanSchema.safeParse({
        ...parsed,
        dailyBudgetEur: Number(parsed.dailyBudgetEur) || 20,
        countries: Array.isArray(parsed.countries) && parsed.countries.length ? parsed.countries : input.markets,
        landingPage: input.landingUrl,
        source: 'openai',
      });
      if (coerced.success) return clampRsa(coerced.data);
    } catch (e) {
      console.error('[ads-planner] attempt failed', {
        attempt,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return buildFallbackGoogleAdsPlan(input);
}

interface Queryable {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
}

/**
 * Stage the plan in the real ads tables so /admin/observability lists it:
 * one google ad variant (RSA copy) + one campaign row in status 'draft'.
 * `productRowId` must be a dropship_store_products.id (variant FK is NOT NULL).
 * Never throws; returns ids or null when staging was skipped/failed.
 */
export async function stageGoogleAdsPlan(
  db: Queryable,
  args: { storeId: string; productRowId: string | null; plan: GoogleAdsPlan },
): Promise<{ variantId: string | null; campaignId: string | null }> {
  if (!args.productRowId) return { variantId: null, campaignId: null };
  try {
    const batchId = `plan-${args.storeId.slice(0, 8)}-${Date.now().toString(36)}`;
    const variantRes = await db.query(
      `INSERT INTO dropship_ad_variants
         (store_id, product_id, batch_id, channel, headline, primary_text, description, cta, meta)
       VALUES ($1, $2, $3, 'google', $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        args.storeId,
        args.productRowId,
        batchId,
        args.plan.headlines[0] ?? args.plan.campaignName.slice(0, 30),
        args.plan.headlines.join(' | '),
        args.plan.descriptions[0] ?? null,
        'Découvrir',
        JSON.stringify({ kind: 'launch-plan', source: args.plan.source }),
      ],
    );
    const variantId = (variantRes.rows[0] as { id?: string } | undefined)?.id ?? null;
    if (!variantId) return { variantId: null, campaignId: null };

    const campaignRes = await db.query(
      `INSERT INTO dropship_ad_campaigns
         (store_id, variant_id, channel, status, daily_budget_eur, targeting_json, push_payload)
       VALUES ($1, $2, 'google', 'draft', $3, $4, $5)
       RETURNING id`,
      [
        args.storeId,
        variantId,
        args.plan.dailyBudgetEur,
        JSON.stringify({ countries: args.plan.countries, audience: args.plan.audience }),
        JSON.stringify(args.plan),
      ],
    );
    const campaignId = (campaignRes.rows[0] as { id?: string } | undefined)?.id ?? null;
    return { variantId, campaignId };
  } catch (e) {
    console.error('[ads-planner] staging failed', {
      storeId: args.storeId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { variantId: null, campaignId: null };
  }
}
