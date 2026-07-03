import { medusa } from '@/lib/medusa';
import { getDb } from '@/lib/db';
import { listSuppliers, searchAllSuppliers, type ProductSource } from '@/lib/suppliers/registry';
import { EXCLUDED_PLATFORMS, evaluateDropshipPure } from '@/lib/suppliers/policy';
import type { RawProduct } from '@/lib/suppliers/types';
import { filterByImageQuality, type ImageQualityVerdict } from './image-quality';
import { generateCollectionHero, generateMonoAssets } from './asset-generator';
import { suggestTemplate } from '@/lib/template-catalog';
import { writeLandingContent } from './landing-writer';
import { extractJson, extractAndValidateJson, type JsonExtractionError } from './json';
import { GeneratedCatalogSchema, EnrichedCatalogSchema } from './store-schema';
import { trackedOpenAIMessage } from './openai-agent';
import { runContext } from './run-context';
import { rankAndKeepTop } from './product-scorer';
import { buildMedusaHandle, slugifyTitle } from './handle';
import { buildPaletteFromPreset, getPreset } from '@/lib/design/presets';
import { generateGoogleAdsPlan, stageGoogleAdsPlan } from './ads-planner';
import { evaluateStoreReadiness } from './store-readiness';
import {
  saveStoreReport,
  type StoreRunReport,
  type SupplierRunOutcome,
  type ProductRunReport,
} from './store-report';

export interface StoreCreationInput {
  niche: string;
  storeName: string;
  maxProducts?: number;
  language?: 'fr' | 'en';
  /**
   * mono = single hero SKU + auto-generated hero/lifestyle/video assets.
   * collection = 3-25 SKUs catalogue, no asset generation (current behaviour).
   */
  mode?: 'mono' | 'collection';
  /** Skip the 5s promo video (faster + cheaper). Only relevant when mode='mono'. */
  skipVideo?: boolean;
  /**
   * Design system locked at creation. The chat picker writes these three
   * fields once and they become the source of truth — every storefront
   * component reads from `dropship_stores.design_preset` + `.palette`
   * instead of inventing colors or fonts on each render.
   */
  designPreset?:
    | 'editorial-serif'
    | 'tech-mono'
    | 'brutalist-luxe'
    | 'gen-z-bold'
    | 'lifestyle-warm';
  primaryColor?: string;
  accentColor?: string;
  /** Storefront template id chosen by the operator (or suggested by the
   *  research-copilot). When the template is in the `luxury` register, the
   *  asset generator + landing writer switch to luxury voice instead of the
   *  standard DTC defaults. Defaults to `'auto'` if absent. */
  template?: string;
  /**
   * Free-form operator brief. Injected into product selection, enrichment and
   * the Google Ads plan so constraints like "forte marge, expédition fiable,
   * pas de produits médicaux réglementés" actually steer the agent.
   */
  brief?: string;
  /** Target markets as ISO country codes (default ['FR']). */
  markets?: string[];
}

export interface AgentEvent {
  type: 'step' | 'progress' | 'success' | 'error' | 'done';
  message: string;
  data?: Record<string, unknown>;
}

interface EnrichedProduct {
  originalTitle: string;
  enrichedTitle: string;
  enrichedDescription: string;
  priceCents: number;
  costCents: number;
  imageUrl: string;
  supplierUrl: string;
  supplier: ProductSource;
  externalId: string;
  /** Agent-assessed sourcing/compliance risk (defaults to 'unknown'). */
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  /** Short FR note on fit for the target markets. */
  marketFit: string;
  /** Why the agent selected this product. */
  selectionReason: string;
}

interface BrandingResult {
  tagline: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoEmoji: string;
}

// Slug helper kept local for store-name slugs; product handles go through
// buildMedusaHandle so the Google Merchant feed and the import path share
// the same convention.
const slugify = slugifyTitle;

/**
 * Find an existing resumable store for this (storeName, niche) pair, or create
 * a new draft. A resumable store is one that is not yet published and not fully
 * ready: draft, generating, validating, needs_repair, or failed. This prevents
 * the Lumora/Habibi duplicate rows caused by retries creating a new slug each
 * time. If the operator explicitly wants a fresh version, they can rename the
 * store or delete the old draft first.
 */
type DbLike = {
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>;
};

async function findOrCreateDraftStore(
  db: DbLike,
  input: StoreCreationInput,
): Promise<{ storeId: string; slug: string; isResume: boolean }> {
  const baseSlug = slugify(input.storeName);
  const candidateSlug = `${baseSlug}-${Date.now().toString(36)}`;

  // Look for an existing resumable store with the same name/niche.
  const existingRes = await db.query<{ id: string; slug: string }>(
    `SELECT id, slug
     FROM dropship_stores
     WHERE name = $1 AND niche = $2
       AND status IN ('draft', 'generating', 'validating', 'needs_repair', 'failed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.storeName, input.niche],
  );

  if (existingRes.rows[0]) {
    const row = existingRes.rows[0];
    await db.query(
      `UPDATE dropship_stores
       SET status = 'generating', error_phase = NULL, error_path = NULL,
           error_expected = NULL, error_received = NULL, error_raw_excerpt = NULL,
           error_message = NULL, readiness_score = 0, updated_at = now()
       WHERE id = $1`,
      [row.id],
    );
    return { storeId: row.id, slug: row.slug, isResume: true };
  }

  // No resumable store: create a fresh draft.
  const insertRes = await db.query<{ id: string }>(
    `INSERT INTO dropship_stores (slug, name, niche, mode, status, template)
     VALUES ($1, $2, $3, $4, 'draft', 'auto')
     RETURNING id`,
    [candidateSlug, input.storeName, input.niche, input.mode ?? 'collection'],
  );
  return { storeId: insertRes.rows[0]!.id, slug: candidateSlug, isResume: false };
}

async function persistStructuredError(
  db: DbLike,
  storeId: string,
  status: 'failed' | 'needs_repair' | 'generating',
  message: string,
  error?: JsonExtractionError | null,
): Promise<void> {
  try {
    await db.query(
      `UPDATE dropship_stores
       SET status = $1,
           error_message = $2,
           error_phase = $3,
           error_path = $4,
           error_expected = $5,
           error_received = $6,
           error_raw_excerpt = $7,
           updated_at = now()
       WHERE id = $8`,
      [
        status,
        message,
        error?.phase ?? null,
        error?.path ?? null,
        error?.expected ?? null,
        error?.received ?? null,
        error?.rawExcerpt ? error.rawExcerpt.slice(0, 1000) : null,
        storeId,
      ],
    );
  } catch (e) {
    console.error('[store-creator] persistStructuredError failed', e);
  }
}

interface SupplierSearchOutcome {
  products: RawProduct[];
  bySupplier: Record<string, number>;
  errors: string[];
}

async function searchSuppliers(
  niche: string,
  maxPerSupplier: number,
  emit: (e: AgentEvent) => void,
): Promise<SupplierSearchOutcome> {
  const { products, errors } = await searchAllSuppliers({
    keywords: niche,
    pageSize: maxPerSupplier,
    currency: 'EUR',
    countryCode: 'FR',
    locale: 'fr_FR',
  });

  // Derive per-supplier counts for the progress event (mirrors old AE/CJ split).
  const bySupplier: Record<string, number> = {};
  for (const p of products) {
    bySupplier[p.supplier] = (bySupplier[p.supplier] ?? 0) + 1;
  }

  if (products.length > 0) {
    const parts = Object.entries(bySupplier).map(([s, n]) => `${s}: ${n}`);
    emit({
      type: 'progress',
      message: `${products.length} produits fournisseurs trouvés (${parts.join(', ')})`,
      data: { ...bySupplier, total: products.length },
    });
  }

  // Surface supplier connectivity errors (mirrors old per-supplier failure log).
  for (const err of errors) {
    emit({ type: 'progress', message: `⚠ Fournisseur: ${err}` });
  }

  return { products, bySupplier, errors };
}

/**
 * Snapshot of the FULL supplier policy for this run: every registered client
 * (considered + per-run outcome), the AutoDS automation layer, and every
 * hard-excluded platform with its justification. Pure and synchronous — the
 * source of truth is code (registry + policy), not the DB mirror.
 */
function buildSupplierOutcomes(outcome: SupplierSearchOutcome): SupplierRunOutcome[] {
  const errorFor = (id: string) => outcome.errors.find((e) => e.startsWith(`${id}:`));
  const rows: SupplierRunOutcome[] = listSuppliers().map((s) => {
    const verdict = evaluateDropshipPure(s);
    const found = outcome.bySupplier[s.id] ?? 0;
    const err = errorFor(s.id);
    let reason: string;
    if (!verdict.ok) {
      reason = `Hors socle dropship-pur (${verdict.blockedBy.join(', ')})`;
    } else if (found > 0) {
      reason = `${found} produit${found > 1 ? 's' : ''} retenu${found > 1 ? 's' : ''} pour la sélection`;
    } else if (err) {
      reason = `Interrogé mais indisponible: ${err.slice(err.indexOf(':') + 1).trim()}`;
    } else {
      reason = 'Interrogé, aucun résultat pertinent pour cette niche';
    }
    return {
      id: s.id,
      label: s.label,
      tier: s.tier,
      status: s.status,
      considered: verdict.ok,
      eligible: verdict.ok,
      productsFound: found,
      reason,
    };
  });

  rows.push({
    id: 'autods',
    label: 'AutoDS (automation)',
    status: 'automation',
    considered: false,
    eligible: false,
    productsFound: 0,
    reason: 'Couche d automatisation, pas une source produits',
  });

  for (const p of EXCLUDED_PLATFORMS) {
    rows.push({
      id: p.id,
      label: p.label,
      status: 'excluded',
      considered: false,
      eligible: false,
      productsFound: 0,
      reason: p.note,
    });
  }

  return rows;
}

// Output token budget for a multi-product JSON payload. Each product carries a
// 130-170 word description (~250 tokens) plus title/price/keys; branding adds
// ~250. The old flat 4096 ceiling truncated ~12-product payloads mid-JSON,
// surfacing as "invalid JSON". Scale with product count, clamp to the model's
// practical output limit.
function tokenBudgetForProducts(maxProducts: number): number {
  return Math.min(16384, Math.max(8192, maxProducts * 500 + 2000));
}

/**
 * Call the agent model in JSON mode and parse the payload, with ONE retry on
 * an unparseable body. Returns the parsed object plus the finishReason of the
 * last attempt; `parsed` is null when both attempts failed. The raw head of a
 * failed body is surfaced through `emit` so the operator sees WHY instead of a
 * bare "invalid JSON".
 */
async function callJsonModel<T>(
  step: string,
  prompt: string,
  maxTokens: number,
  emit: (e: AgentEvent) => void,
  schema?: import('zod').ZodType<T>,
): Promise<{ parsed: T | null; finishReason: string | null; errorDetails?: JsonExtractionError }> {
  let finishReason: string | null = null;
  let lastErrorDetails: JsonExtractionError | undefined = undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { text, finishReason: fr } = await trackedOpenAIMessage(
      { step },
      [{ role: 'user', content: prompt }],
      { maxTokens, jsonMode: true },
    );
    finishReason = fr;

    if (schema) {
      const { parsed, error } = extractAndValidateJson(text, schema, step);
      if (parsed) return { parsed, finishReason };
      
      lastErrorDetails = error;
      emit({
        type: 'progress',
        message: `⚠ Erreur de validation (tentative ${attempt}/2) · ${error?.message}`,
        data: { error }
      });
    } else {
      const parsed = extractJson<T>(text);
      if (parsed) return { parsed, finishReason };
      emit({
        type: 'progress',
        message: `⚠ Réponse IA non parsable (tentative ${attempt}/2)${text ? ` · début: ${text.slice(0, 120)}` : ' · réponse vide'}`,
      });
    }
  }
  return { parsed: null, finishReason, errorDetails: lastErrorDetails };
}

/** Shared FR/EN operator-brief block injected into the selection prompts. */
function briefBlock(brief: string | undefined, markets: string[]): string {
  const marketLine = `Target markets: ${markets.join(' + ')}. Every product must ship reliably to these markets.`;
  if (!brief?.trim()) return marketLine;
  return `${marketLine}

Operator brief (MUST be respected for selection, pricing, risk and copy):
${brief.trim().slice(0, 4000)}`;
}

const PRODUCT_RISK_CONTRACT = `
      "riskLevel": "low | medium | high — sourcing/compliance risk (regulated, fragile, claims-sensitive)",
      "marketFit": "one short sentence: fit for the target markets",
      "selectionReason": "one short sentence: why this product was selected"`;

type RiskFields = { riskLevel?: string; marketFit?: string; selectionReason?: string };

/**
 * Normalize a model-emitted money amount to integer euro CENTS.
 * The contract asks for cents, but GPT intermittently answers in decimal
 * euros (88.49 instead of 8849) — that killed a whole import batch with
 * `invalid input syntax for type integer`. Rule: a non-integer value is
 * decimal euros (× 100); an integer is already cents.
 */
function normalizeCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (!Number.isInteger(n)) return Math.round(n * 100);
  return n;
}

function normalizeRisk(p: RiskFields): Pick<EnrichedProduct, 'riskLevel' | 'marketFit' | 'selectionReason'> {
  const risk = typeof p.riskLevel === 'string' ? p.riskLevel.toLowerCase().trim() : '';
  return {
    riskLevel: risk === 'low' || risk === 'medium' || risk === 'high' ? risk : 'unknown',
    marketFit: typeof p.marketFit === 'string' && p.marketFit.trim() ? p.marketFit.trim() : 'Non évalué',
    selectionReason:
      typeof p.selectionReason === 'string' && p.selectionReason.trim()
        ? p.selectionReason.trim()
        : 'Sélection par pertinence niche',
  };
}

// Called when supplier APIs have no results — the agent model generates concepts
async function generateProductsWithClaude(
  niche: string,
  storeName: string,
  maxProducts: number,
  language: 'fr' | 'en',
  emit: (e: AgentEvent) => void,
  brief?: string,
  markets: string[] = ['FR'],
): Promise<{ products: EnrichedProduct[]; branding: BrandingResult }> {
  emit({ type: 'step', message: `APIs fournisseurs indisponibles — génération IA des produits pour "${niche}"...` });

  const langInstruction = language === 'fr'
    ? 'Write ALL content in French (titles, descriptions).'
    : 'Write ALL content in English.';

  const { parsed, finishReason, errorDetails } = await callJsonModel<import('zod').infer<typeof GeneratedCatalogSchema>>(
    'generate-products',
    `You are a dropshipping expert. Create a complete product catalog for a dropshipping store.

Store name: "${storeName}"
Niche: "${niche}"
Number of products needed: ${maxProducts}
${langInstruction}
${briefBlock(brief, markets)}

Generate ${maxProducts} realistic dropshipping products for this niche. These should be products typically found on AliExpress or CJ Dropshipping. Avoid regulated medical devices, excessive health claims and dangerous goods.

Return ONLY valid JSON:
{
  "products": [
    {
      "id": "ai-001",
      "originalTitle": "Raw product name as it would appear from supplier",
      "enrichedTitle": "Compelling retail title (max 65 chars)",
      "enrichedDescription": "Benefit-focused description (130-170 words). Include key features, materials, use cases, and why customers love it.",
      "costCents": <INTEGER euro cents, realistic for AliExpress pricing, e.g. 850 for €8.50 — NEVER decimal euros>,
      "retailPriceCents": <INTEGER euro cents = cost * 2.2 rounded to nearest .99, min 999, e.g. 2199 for €21.99>,
      "imageUrl": "",
      "supplierUrl": "",${PRODUCT_RISK_CONTRACT}
    }
  ],
  "branding": {
    "tagline": "Short punchy tagline (max 60 chars)",
    "description": "Store description (40-60 words)",
    "primaryColor": "#hex dark/saturated color for header/footer",
    "secondaryColor": "#hex very light tint of primaryColor for backgrounds (NOT a random color — must be the SAME HUE as primary, just very light)",
    "accentColor": "#hex vibrant color for CTAs (MUST be ANALOGOUS to primaryColor — same hue family or one step on the color wheel. NEVER a complementary clash like green+pink, blue+orange, purple+yellow. Aim for primary=dark teal → accent=warmer teal/turquoise, NOT primary=dark green → accent=hot pink.)",
    "logoEmoji": "one emoji that fits the niche"
  }
}

Hard color rule: the three colors must form a coherent palette. If you cannot guarantee that, default to a monochromatic palette built from one hue (e.g. primary=#1F3D2C dark, secondary=#EAF2EC light, accent=#2E7D5C mid). Random complementary stunts ruin the storefront.`,
    tokenBudgetForProducts(maxProducts),
    emit,
    GeneratedCatalogSchema
  );

  if (!parsed) {
    // Truncation takes precedence over validation errors.
    if (finishReason === 'length') {
      const e = new Error('Réponse IA tronquée (limite de tokens) — réessayez ou réduisez le nombre de produits') as Error & { details?: JsonExtractionError };
      e.details = errorDetails;
      throw e;
    }
    if (errorDetails) {
      const e = new Error(`Erreur de validation JSON: ${errorDetails.message}`) as Error & { details?: JsonExtractionError };
      e.details = errorDetails;
      throw e;
    }
    throw new Error('Réponse IA non exploitable pour la génération produits (JSON invalide après 2 tentatives)');
  }

  if (!parsed.products?.length || !parsed.branding) {
    throw new Error(`Claude returned incomplete payload (products=${parsed.products?.length ?? 0}, branding=${!!parsed.branding})`);
  }

  emit({
    type: 'progress',
    message: `✨ ${parsed.products.length} produits générés par Claude AI`,
    data: { count: parsed.products.length, source: 'ai-generated' },
  });

  const products: EnrichedProduct[] = parsed.products.map(p => ({
    originalTitle: p.originalTitle,
    enrichedTitle: p.enrichedTitle,
    enrichedDescription: p.enrichedDescription,
    priceCents: normalizeCents(p.retailPriceCents),
    costCents: normalizeCents(p.costCents),
    imageUrl: p.imageUrl || '',
    supplierUrl: p.supplierUrl || '',
    supplier: 'ai-generated' as const,
    externalId: p.id,
    ...normalizeRisk(p),
  }));

  return { products, branding: parsed.branding };
}

async function enrichSupplierProductsWithClaude(
  niche: string,
  storeName: string,
  rawProducts: RawProduct[],
  maxProducts: number,
  language: 'fr' | 'en',
  emit: (e: AgentEvent) => void,
  brief?: string,
  markets: string[] = ['FR'],
): Promise<{ products: EnrichedProduct[]; branding: BrandingResult }> {
  const langInstruction = language === 'fr'
    ? 'Write all content in French.'
    : 'Write all content in English.';

  emit({ type: 'step', message: 'Sélection et enrichissement IA des produits...' });

  const productsJson = JSON.stringify(
    rawProducts.slice(0, 40).map((p, i) => ({
      index: i,
      supplier: p.supplier,
      id: p.externalId,
      title: p.title,
      cost_eur: p.price,
      has_image: !!p.imageUrl,
    })),
    null,
    2,
  );

  const { parsed, finishReason, errorDetails } = await callJsonModel<import('zod').infer<typeof EnrichedCatalogSchema>>(
    'enrich-products',
    `You are an expert dropshipping product specialist and copywriter.

Store name: "${storeName}"
Niche: "${niche}"
${langInstruction}
${briefBlock(brief, markets)}

Raw supplier products:
${productsJson}

Tasks:
1. Select the best ${maxProducts} products most relevant to the niche and the operator brief. Reject regulated medical devices, excessive health claims and dangerous goods. VARIETY IS MANDATORY: never select two variants, colorways or sizes of the same physical product — every pick must be a clearly different product.
2. Write a compelling title (max 65 chars) and description (130-170 words) for each.
3. Retail price = cost * 2.2 rounded to nearest .99, minimum €9.99.
4. Assess each product: risk level, market fit, selection reason.
5. Generate store branding.

Return ONLY valid JSON. Emit "branding" FIRST so it survives even if the
response is long:
{
  "branding": {
    "tagline": "...",
    "description": "...",
    "primaryColor": "#hex dark/saturated",
    "secondaryColor": "#hex very light tint of the SAME hue as primaryColor",
    "accentColor": "#hex vibrant but ANALOGOUS to primaryColor (same hue family, never a complementary clash like green+pink, blue+orange, purple+yellow). Prefer monochromatic. Random complementary stunts ruin the storefront.",
    "logoEmoji": "emoji"
  },
  "products": [
    {
      "index": <original index number>,
      "enrichedTitle": "...",
      "enrichedDescription": "...",
      "retailPriceCents": <INTEGER euro cents, e.g. 2199 for €21.99 — NEVER decimal euros>,
      "costCents": <INTEGER euro cents = cost_eur * 100, e.g. 850 for €8.50>,${PRODUCT_RISK_CONTRACT}
    }
  ]
}`,
    tokenBudgetForProducts(maxProducts),
    emit,
    EnrichedCatalogSchema
  );

  if (!parsed) {
    // Truncation takes precedence over validation errors — if the response was
    // cut off, that is the root cause even if the fragment also fails validation.
    if (finishReason === 'length') {
      const e = new Error('Réponse IA tronquée (limite de tokens) — réessayez ou réduisez le nombre de produits') as Error & { details?: JsonExtractionError };
      e.details = errorDetails;
      throw e;
    }
    if (errorDetails) {
      const e = new Error(`Erreur de validation JSON: ${errorDetails.message}`) as Error & { details?: JsonExtractionError };
      e.details = errorDetails;
      throw e;
    }
    throw new Error('Réponse IA non exploitable pour l enrichissement (JSON invalide après 2 tentatives)');
  }

  // A salvaged (truncated) payload can carry products whose `index` is missing
  // from rawProducts — skip those rather than crash on `raw.title`.
  const enriched: EnrichedProduct[] = (parsed.products ?? [])
    .filter(ep => rawProducts[ep.index])
    .map(ep => {
      const raw = rawProducts[ep.index];
      return {
        originalTitle: raw.title,
        enrichedTitle: ep.enrichedTitle,
        enrichedDescription: ep.enrichedDescription,
        priceCents: normalizeCents(ep.retailPriceCents),
        costCents: normalizeCents(ep.costCents),
        imageUrl: raw.imageUrl,
        supplierUrl: raw.supplierUrl,
        supplier: raw.supplier as ProductSource,
        externalId: raw.externalId,
        ...normalizeRisk(ep),
      };
    });

  if (!enriched.length || !parsed.branding) {
    throw new Error(
      finishReason === 'length'
        ? 'Réponse IA tronquée (limite de tokens) — réessayez ou réduisez le nombre de produits'
        : `Claude returned incomplete payload (products=${enriched.length}, branding=${!!parsed.branding})`,
    );
  }

  emit({
    type: 'progress',
    message: `${enriched.length} produits enrichis par Claude`,
    data: { count: enriched.length },
  });

  return { products: enriched, branding: parsed.branding };
}

// Deterministic product image using picsum with a seed derived from the title
function fetchProductImage(query: string): string {
  const seed = query
    .toLowerCase()
    .split('')
    .reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7);
  return `https://picsum.photos/seed/${seed}/600/600`;
}

export async function* createStore(input: StoreCreationInput): AsyncGenerator<AgentEvent> {
  const events: AgentEvent[] = [];
  let resolveNext: ((v: { value: AgentEvent; done: false }) => void) | null = null;
  let done = false;

  // Full event log, persisted in the run report so the admin can replay the
  // run after the SSE stream is gone.
  const eventLog: StoreRunReport['events'] = [];

  const emit = (e: AgentEvent) => {
    eventLog.push({ ts: new Date().toISOString(), type: e.type, message: e.message });
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r({ value: e, done: false });
    } else {
      events.push(e);
    }
  };

  const mode = input.mode ?? 'collection';
  // Mono mode is locked to a single SKU regardless of maxProducts. Collection
  // mode uses the requested count (default 12).
  const maxProducts = mode === 'mono' ? 1 : input.maxProducts ?? 12;
  const language = input.language ?? 'fr';
  const markets = input.markets?.length ? input.markets.map((m) => m.toUpperCase()) : ['FR'];
  const brief = input.brief?.trim() || undefined;

  const run = async () => {
    const db = getDb();

    // Report scaffold filled as the run progresses; saved on success AND error.
    const report: StoreRunReport = {
      version: 1,
      storeId: '',
      storeName: input.storeName,
      slug: '',
      niche: input.niche,
      mode,
      language,
      template: input.template ?? 'auto',
      brief: brief ?? null,
      markets,
      suppliers: [],
      products: [],
      assets: { status: 'supplier-images', notes: '' },
      adsPlan: null,
      events: eventLog,
      createdAt: new Date().toISOString(),
    };

    try {
      emit({ type: 'step', message: `Démarrage de l'agent pour "${input.storeName}" (niche: ${input.niche})` });

      // Find or create a draft. This is the idempotency gate: retries on the
      // same name/niche resume the existing draft instead of spawning a new
      // store row (Lumora/Habibi duplication root cause).
      const { storeId, slug, isResume } = await findOrCreateDraftStore(db, input);
      report.storeId = storeId;
      report.slug = slug;

      // Template resolution: explicit operator choice wins; otherwise agent picks.
      const requestedTemplate = input.template && input.template !== 'auto' ? input.template : null;
      const chosenTemplate =
        requestedTemplate ??
        suggestTemplate({ niche: input.niche, mode, productCount: maxProducts, brief });

      await db.query(
        `UPDATE dropship_stores
         SET status = 'generating', template = $1, updated_at = now()
         WHERE id = $2`,
        [chosenTemplate, storeId],
      );
      report.template = chosenTemplate;

      emit({
        type: 'progress',
        message: isResume
          ? `Reprise du draft existant · ${slug}`
          : requestedTemplate
            ? `Template imposé par l'opérateur: ${chosenTemplate}`
            : `Template retenu par l'agent: ${chosenTemplate}`,
        data: { template: chosenTemplate, slug, resumed: isResume },
      });

      if (brief) {
        emit({ type: 'progress', message: `Brief opérateur pris en compte (${markets.join(' + ')})` });
      }

      // From here on every model call landed via the tracked wrappers will
      // pick up storeId automatically (AsyncLocalStorage in run-context).
      await runContext.run({ storeId }, async () => {

      emit({ type: 'step', message: 'Recherche produits chez les fournisseurs dropshipping...' });

      const searchOutcome = await searchSuppliers(input.niche, 25, emit);
      const rawProducts = searchOutcome.products;

      // Supplier policy snapshot: which platforms were considered, which are
      // excluded and why. Persisted in the report + surfaced as an event.
      report.suppliers = buildSupplierOutcomes(searchOutcome);
      const consideredCount = report.suppliers.filter((s) => s.considered).length;
      const excludedCount = report.suppliers.filter((s) => s.status === 'excluded').length;
      emit({
        type: 'progress',
        message: `Politique fournisseurs: ${consideredCount} sources interrogées, ${excludedCount} plateformes exclues (MOQ/grossiste/sans API)`,
        data: { considered: consideredCount, excluded: excludedCount },
      });

      // ── P0.5 Deterministic pre-vision scorer ────────────────────────
      // Before paying Haiku Vision $0.001/image to score every supplier
      // result, rank with a pure formula (cost / orders / rating / margin
      // / image-presence) and keep top 25. Cuts the vision token bill
      // ~50% and stops asking the model to look at obvious junk.
      const PRE_VISION_TOP_N = 25;
      const initialCount = rawProducts.length;
      if (initialCount > PRE_VISION_TOP_N) {
        const ranked = rankAndKeepTop(rawProducts, PRE_VISION_TOP_N);
        // Decorated items keep all original RawProduct fields + _score +
        // _scoreReasons. We strip the underscore fields when re-assigning
        // so the rest of the pipeline sees the same shape, but we log
        // a debug breakdown via the SSE event.
        const topScore = ranked[0]?._score ?? 0;
        const bottomScore = ranked[ranked.length - 1]?._score ?? 0;
        rawProducts.length = 0;
        rawProducts.push(...ranked.map(({ _score: _s, _scoreReasons: _r, ...p }) => p));
        emit({
          type: 'step',
          message: `${ranked.length} candidats retenus par score (top ${PRE_VISION_TOP_N} sur ${initialCount})`,
          data: { kept: ranked.length, total: initialCount, topScore, bottomScore },
        });
      }

      // Vision filter: rejects supplier images with text overlays, prices,
      // discount badges, watermarks, collages, human models. Mandatory for
      // mono (the hero IS the brand) — for collection we still rank but don't
      // fail the run if everything fails.
      const visionVerdicts = new Map<string, ImageQualityVerdict>();
      if (rawProducts.length > 0) {
        emit({
          type: 'step',
          message: `Filtre vision Claude — analyse de ${rawProducts.length} images produit...`,
        });
        const { kept, rejected } = await filterByImageQuality(
          rawProducts.map((p) => ({ ...p, imageUrl: p.imageUrl })),
          mode === 'mono' ? 0.65 : 0.5,
        );
        kept.forEach((p) => visionVerdicts.set(p.externalId, p._quality));
        rejected.forEach((p) => visionVerdicts.set(p.externalId, p._quality));

        emit({
          type: 'progress',
          message: `${kept.length} produits qualifiés · ${rejected.length} rejetés (écritures/prix/badges)`,
          data: { kept: kept.length, rejected: rejected.length },
        });

        // Replace rawProducts with kept (sorted by score desc); fall back to
        // unfiltered if vision rejected everything (no supplier match is a
        // worse outcome than a slightly-noisy image).
        if (kept.length > 0) {
          rawProducts.length = 0;
          rawProducts.push(...kept.map(({ _quality: _q, ...p }) => p));
        } else {
          // Everything was rejected. Keep going, but actually honour the
          // message: re-sort rawProducts by the vision score (desc) so the
          // "meilleures" really do come first instead of the raw supplier
          // order. `rejected` carries the same items with their _quality score.
          const rankedRejected = [...rejected].sort(
            (a, b) => b._quality.score - a._quality.score,
          );
          rawProducts.length = 0;
          rawProducts.push(...rankedRejected.map(({ _quality: _q, ...p }) => p));
          emit({
            type: 'progress',
            message: '⚠ Aucune image n’a passé le filtre — on continue avec les meilleures malgré tout',
          });
        }
      }

      let enriched: EnrichedProduct[];
      let branding: BrandingResult;

      if (rawProducts.length === 0) {
        // Fallback: let Claude generate the whole catalog. This can THROW when
        // the model returns truncated/invalid/empty JSON — in that case degrade
        // gracefully: emit an explicit failure event and fail the run with a
        // clear, actionable structured error (via the existing
        // persistStructuredError mechanism) instead of letting a raw crash
        // bubble up as a bare 'failed' status with no diagnostic.
        emit({ type: 'progress', message: 'APIs fournisseurs non disponibles — passage en mode génération IA pure.' });

        let aiResult: Awaited<ReturnType<typeof generateProductsWithClaude>>;
        try {
          aiResult = await generateProductsWithClaude(input.niche, input.storeName, maxProducts, language, emit, brief, markets);
        } catch (genErr) {
          const reason = genErr instanceof Error ? genErr.message : 'erreur inconnue';
          const details = (genErr instanceof Error && 'details' in genErr)
            ? (genErr as Error & { details?: JsonExtractionError }).details
            : null;
          const fallbackMsg = `Génération IA des produits impossible: ${reason}. Aucun fournisseur n'a répondu et le modèle n'a pas produit de catalogue exploitable — relancez le run ou réduisez le nombre de produits.`;
          emit({ type: 'progress', message: `⚠ Fallback génération IA échoué: ${reason}` });
          // Reuse the existing structured-error mechanism (error_phase/message…).
          const structuredFallback: JsonExtractionError = {
            ...(details ?? {}),
            phase: details?.phase ?? 'generate-products',
            message: fallbackMsg,
          } as JsonExtractionError;
          const abortErr = new Error(fallbackMsg) as Error & { details?: JsonExtractionError };
          abortErr.details = structuredFallback;
          throw abortErr;
        }

        emit({ type: 'step', message: 'Attribution des visuels produits...' });
        for (const p of aiResult.products) {
          if (!p.imageUrl) {
            p.imageUrl = fetchProductImage(p.enrichedTitle);
          }
        }

        enriched = aiResult.products;
        branding = aiResult.branding;
      } else {
        // Enrich real supplier products
        const result = await enrichSupplierProductsWithClaude(
          input.niche, input.storeName, rawProducts, maxProducts, language, emit, brief, markets,
        );
        enriched = result.products;
        branding = result.branding;
      }

      // Operator-locked palette: if the chat picker confirmed colors, those
      // OVERRIDE whatever Claude generated during enrichment. The whole point
      // of the picker is that the operator decides once and nothing else
      // gets to change them.
      if (input.primaryColor) branding.primaryColor = input.primaryColor;
      if (input.accentColor) branding.accentColor = input.accentColor;

      // Medusa provisioning is best-effort: when the backend is down the run
      // MUST still deliver a store — products are persisted in Postgres with
      // medusa_product_id NULL and the storefront checkout is deferred. A dead
      // run that loses the whole selection is a worse outcome than a store
      // pending its sales channel.
      let channelId: string | null = null;
      let publishableKey: string | null = null;
      try {
        emit({ type: 'step', message: 'Création du canal de vente Medusa...' });
        const channel = await medusa.createSalesChannel(
          input.storeName,
          `Store dropshipping — ${input.niche}`,
        );

        emit({ type: 'step', message: 'Création de la clé API publique...' });
        try {
          const apiKey = await medusa.createPublishableApiKey(`${input.storeName} Store Key`);
          await medusa.addSalesChannelsToPublishableKey(apiKey.id, [channel.id]);

          // Without this link, Medusa /store/shipping-options returns 0 options
          // for any cart on this sales_channel — checkout would dead-end at "no
          // shipping option available". We use the first stock_location (a
          // single warehouse setup is the assumption for this MVP).
          const stockLocations = await medusa.listStockLocations();
          if (stockLocations[0]) {
            await medusa.linkSalesChannelsToStockLocation(stockLocations[0].id, [channel.id]);
          } else {
            console.warn('[store-creator] no stock_location to link new sales channel to', { channelId: channel.id });
          }
          channelId = channel.id;
          publishableKey = apiKey.token;
        } catch (e) {
          console.error('[store-creator] publishable key / stock-location setup failed, rolling back', {
            channelId: channel.id,
            error: e instanceof Error ? e.message : String(e),
          });
          await medusa.deleteSalesChannel(channel.id).catch(() => {});
          throw e;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'erreur inconnue';
        emit({
          type: 'progress',
          message: `⚠ Medusa indisponible (${msg}). Produits persistés en local, canal de vente à reprovisionner.`,
        });
      }
      const medusaOk = Boolean(channelId && publishableKey);

      emit({
        type: 'step',
        message: medusaOk
          ? `Import de ${enriched.length} produits dans Medusa...`
          : `Persistance locale de ${enriched.length} produits (Medusa hors ligne)...`,
      });

      const IMPORT_CONCURRENCY = 4;

      let imported = 0;
      const productStatuses = new Map<string, ProductRunReport['status']>();
      const importOne = async (ep: EnrichedProduct) => {
        let medusaProductId: string | null = null;
        let status: ProductRunReport['status'] = medusaOk ? 'imported' : 'local_only';
        if (medusaOk && channelId) {
          try {
            const handle = buildMedusaHandle({
              title: ep.enrichedTitle,
              externalId: ep.externalId,
              storeId,
            });
            const medusaProduct = await medusa.createProductWithChannel(
              {
                title: ep.enrichedTitle,
                description: ep.enrichedDescription,
                handle,
                status: 'published',
                thumbnail: ep.imageUrl || undefined,
                images: ep.imageUrl ? [ep.imageUrl] : [],
                options: [{ title: 'Default', values: ['Standard'] }],
                variants: [
                  {
                    title: 'Standard',
                    // Medusa v2 stores money in major units (EUR with decimals),
                    // not minor units. The payment-stripe module converts to
                    // Stripe's smallest unit by multiplying by 100, so passing
                    // cents here makes Stripe see 100× the real total.
                    prices: [{ currency_code: 'eur', amount: ep.priceCents / 100 }],
                    inventory_quantity: 999,
                  },
                ],
                metadata: {
                  supplier: ep.supplier,
                  external_id: ep.externalId,
                  cost_cents: ep.costCents,
                  store_id: storeId,
                },
              },
              channelId,
            );
            medusaProductId = medusaProduct.id;
          } catch (err) {
            status = 'import_failed';
            emit({
              type: 'progress',
              message: `⚠ Import Medusa échoué: ${ep.enrichedTitle} — ${err instanceof Error ? err.message : 'erreur'} (produit conservé en local)`,
            });
          }
        }

        try {
          const verdict = visionVerdicts.get(ep.externalId);
          await db.query(
            `INSERT INTO dropship_store_products
               (store_id, medusa_product_id, supplier, external_id,
                original_title, enriched_title, enriched_description,
                price_cents, cost_cents, image_url, supplier_url,
                image_quality_score, image_quality_issues)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (store_id, supplier, external_id) DO NOTHING`,
            [
              storeId, medusaProductId, ep.supplier, ep.externalId,
              ep.originalTitle, ep.enrichedTitle, ep.enrichedDescription,
              ep.priceCents, ep.costCents, ep.imageUrl || null, ep.supplierUrl || null,
              verdict?.score ?? null, JSON.stringify(verdict?.issues ?? []),
            ],
          );

          productStatuses.set(ep.externalId, status);
          imported++;
          emit({
            type: 'progress',
            message: `(${imported}/${enriched.length}) ${ep.enrichedTitle}`,
            data: { imported, total: enriched.length },
          });
        } catch (err) {
          productStatuses.set(ep.externalId, 'import_failed');
          emit({
            type: 'progress',
            message: `⚠ Ignoré: ${ep.enrichedTitle} — ${err instanceof Error ? err.message : 'erreur'}`,
          });
        }
      };

      for (let i = 0; i < enriched.length; i += IMPORT_CONCURRENCY) {
        await Promise.all(enriched.slice(i, i + IMPORT_CONCURRENCY).map(importOne));
      }

      // Per-product report rows: price, cost, margin, risk, market fit, status.
      report.products = enriched.map((ep) => ({
        externalId: ep.externalId,
        supplier: ep.supplier,
        title: ep.enrichedTitle,
        priceCents: ep.priceCents,
        costCents: ep.costCents,
        marginPct: ep.priceCents > 0 && ep.costCents > 0
          ? Math.round(((ep.priceCents - ep.costCents) / ep.priceCents) * 100)
          : null,
        riskLevel: ep.riskLevel,
        marketFit: ep.marketFit,
        status: productStatuses.get(ep.externalId) ?? 'proposed',
        reason: ep.selectionReason,
        imageUrl: ep.imageUrl || null,
      }));
      report.assets = enriched.some((ep) => ep.supplier === 'ai-generated')
        ? { status: 'placeholder', notes: 'Visuels de secours déterministes (picsum seedé) — catalogue généré par IA sans photos fournisseur.' }
        : { status: 'supplier-images', notes: 'Photos fournisseur qualifiées par le filtre vision.' };

      // Locked design system: the picker passed (or defaulted) a preset slug.
      // Resolve it to a curated preset and freeze the palette in DB so every
      // storefront component reads the same source of truth from now on.
      const presetSlug = input.designPreset ?? 'editorial-serif';
      const preset = getPreset(presetSlug);
      const palette = buildPaletteFromPreset(
        preset,
        branding.primaryColor,
        branding.accentColor,
      );

      // Mono stores can't go 'active' until hero asset generation succeeds;
      // collection stores have no asset pipeline, so they activate here.
      await db.query(
        `UPDATE dropship_stores SET
           tagline = $1, description = $2,
           primary_color = $3, secondary_color = $4, accent_color = $5,
           logo_emoji = $6, medusa_sales_channel_id = $7,
           medusa_publishable_key = $8, product_count = $9,
           design_preset = $10, palette = $11, updated_at = now()
         WHERE id = $12`,
        [
          branding.tagline, branding.description,
          branding.primaryColor, branding.secondaryColor, branding.accentColor,
          branding.logoEmoji, channelId, publishableKey, imported,
          preset.slug, JSON.stringify(palette), storeId,
        ],
      );

      // Structured landing copy. We run this AFTER the store is marked
      // active so the storefront is already browseable; templates fall
      // back to generic strings until landing_content is filled in.
      // Failure here is non-fatal — the store still works.
      if (enriched[0]) {
        emit({ type: 'step', message: 'Rédaction de la landing...' });
        const heroProduct = enriched[0];
        try {
          const landing = await writeLandingContent({
            storeName: input.storeName,
            niche: input.niche,
            tagline: branding.tagline,
            storeDescription: branding.description,
            productTitle: heroProduct.enrichedTitle,
            productDescription: heroProduct.enrichedDescription,
            mode,
            template: chosenTemplate,
            accentColor: palette.accent,
            supplierCostCents: heroProduct.costCents,
          });
          await db.query(
            `UPDATE dropship_stores SET landing_content = $1 WHERE id = $2`,
            [JSON.stringify(landing), storeId],
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'erreur inconnue';
          emit({ type: 'progress', message: `⚠ Landing writer: ${msg}` });
        }
      }

      // Collection mode: one branded ambiance hero (fal.ai) so the storefront
      // opens on a real visual instead of a flat color block. Non-fatal — the
      // color hero remains the fallback when fal is absent or fails.
      if (mode === 'collection') {
        emit({ type: 'step', message: 'Génération du visuel de marque (hero)...' });
        const hero = await generateCollectionHero({
          storeSlug: slug,
          storeName: input.storeName,
          niche: input.niche,
          imageryMood: preset.imageryMood,
          onProgress: (msg) => emit({ type: 'progress', message: msg }),
        });
        if (hero.heroUrl) {
          await db.query(
            `UPDATE dropship_stores SET
               hero_image_url = $1, assets_run_id = $2, assets_status = 'ready', updated_at = now()
             WHERE id = $3`,
            [hero.heroUrl, hero.runId, storeId],
          );
          report.assets = {
            status: 'generated',
            notes: 'Hero de marque généré (fal.ai flux-pro ultra) + photos fournisseur pour les fiches produit.',
          };
          emit({ type: 'progress', message: 'Hero de marque généré et persisté' });
        } else if (hero.providerConfigured) {
          // Provider present but failing (balance, network): queue the exact
          // prompt so the operator can replay the generation later.
          report.assets = {
            status: 'pending_generation',
            notes: `Hero de marque en attente: ${hero.error}. Prompt prêt pour régénération, photos fournisseur en attendant.`,
            heroPrompt: hero.prompt,
          };
          emit({ type: 'progress', message: `⚠ Hero de marque en attente (${hero.error}) — prompt persisté pour régénération` });
        } else {
          report.assets.notes = `${report.assets.notes} Hero de marque non généré: ${hero.error}.`.trim();
          report.assets.heroPrompt = hero.prompt;
          emit({ type: 'progress', message: `⚠ Hero de marque: ${hero.error}` });
        }
      }

      // Mono mode: kick off the asset generation pipeline. The store stays
      // 'creating' until hero generation succeeds — we never expose a live
      // storefront with an empty hero. Retry up to 3× with exponential backoff.
      if (mode === 'mono' && enriched[0]) {
        const heroProduct = enriched[0];
        emit({ type: 'step', message: 'Génération des visuels (hero, lifestyles, vidéo)...' });
        await db.query(
          `UPDATE dropship_stores SET assets_status = 'generating' WHERE id = $1`,
          [storeId],
        );

        const MAX_ASSET_RETRIES = 3;
        let assets: Awaited<ReturnType<typeof generateMonoAssets>> | null = null;
        let lastAssetError: string | null = null;

        for (let attempt = 1; attempt <= MAX_ASSET_RETRIES; attempt++) {
          try {
            if (attempt > 1) {
              const delay = (attempt - 1) * 8000;
              emit({ type: 'progress', message: `⏳ Retry génération assets (${attempt}/${MAX_ASSET_RETRIES})…` });
              await new Promise((r) => setTimeout(r, delay));
            }
            assets = await generateMonoAssets(
              {
                storeId,
                storeSlug: slug,
                product: {
                  title: heroProduct.enrichedTitle,
                  description: heroProduct.enrichedDescription,
                  imageUrl: heroProduct.imageUrl,
                },
                niche: input.niche,
                template: chosenTemplate,
                accentColor: palette.accent,
                storeName: input.storeName,
                language,
                skipVideo: input.skipVideo,
                design: {
                  presetSlug: preset.slug,
                  imageryMood: preset.imageryMood,
                  primaryColor: palette.primary,
                  accentColor: palette.accent,
                },
              },
              (msg) => emit({ type: 'progress', message: msg }),
            );
            if (assets.heroUrl) break;
            lastAssetError = 'heroUrl manquant après génération';
            emit({ type: 'progress', message: `⚠ Asset generation tentative ${attempt}: ${lastAssetError}` });
          } catch (e) {
            lastAssetError = e instanceof Error ? e.message : 'erreur inconnue';
            emit({ type: 'progress', message: `⚠ Asset generation tentative ${attempt}: ${lastAssetError}` });
          }
        }

        const hasHero = Boolean(assets?.heroUrl);

        await db.query(
          `UPDATE dropship_stores SET
             assets_run_id = $1, hero_image_url = $2, cutout_image_url = $3,
             lifestyle_images = $4, promo_video_url = $5,
             assets_status = $6, updated_at = now()
           WHERE id = $7`,
          [
            assets?.runId ?? null,
            assets?.heroUrl ?? null,
            assets?.cutoutUrl ?? null,
            JSON.stringify(assets?.lifestyleUrls ?? []),
            assets?.promoVideoUrl ?? null,
            hasHero ? 'ready' : 'error',
            storeId,
          ],
        );

        for (const w of assets?.warnings ?? []) {
          emit({ type: 'progress', message: `⚠ ${w}` });
        }

        if (hasHero) {
          report.assets = { status: 'generated', notes: 'Hero et déclinaisons générés par le pipeline visuel.' };
        } else {
          // Assets failed (fal/Comfy provider down).
          const errMsg = assets?.errors[0] || lastAssetError || 'Génération des assets échouée';
          report.assets = {
            status: 'pending_generation',
            notes: `Provider visuel indisponible (${errMsg}). Photos fournisseur en attendant, régénération possible depuis l admin.`,
          };
          await db.query(
            `UPDATE dropship_stores SET error_message = $1, updated_at = now() WHERE id = $2`,
            [errMsg, storeId],
          );
          emit({ type: 'progress', message: `⚠ Assets non générés après ${MAX_ASSET_RETRIES} tentatives: ${errMsg}.` });
        }
      }

      // Google Ads launch plan: generated on EVERY run (staged, never pushed).
      // Failure is impossible by contract — the planner falls back to a
      // deterministic plan marked source='fallback'.
      emit({ type: 'step', message: 'Préparation du plan Google Ads de lancement...' });
      const adsPlan = await generateGoogleAdsPlan({
        storeName: input.storeName,
        slug,
        niche: input.niche,
        brief,
        markets,
        language,
        landingUrl: `/shop/${slug}`,
        products: enriched.map((ep) => ({
          title: ep.enrichedTitle,
          priceCents: ep.priceCents,
          costCents: ep.costCents,
        })),
      });
      report.adsPlan = adsPlan;

      let heroProductRowId: string | null = null;
      try {
        const heroRow = await db.query<{ id: string }>(
          `SELECT id FROM dropship_store_products WHERE store_id = $1 ORDER BY created_at ASC LIMIT 1`,
          [storeId],
        );
        heroProductRowId = heroRow.rows[0]?.id ?? null;
      } catch {
        heroProductRowId = null;
      }
      const staged = await stageGoogleAdsPlan(db, { storeId, productRowId: heroProductRowId, plan: adsPlan });
      emit({
        type: 'progress',
        message: staged.campaignId
          ? `Plan Google Ads prêt (${adsPlan.source === 'openai' ? 'généré par IA' : 'plan de secours déterministe'}) · campagne draft ${adsPlan.dailyBudgetEur}€/j · ${adsPlan.countries.join(' + ')}`
          : `Plan Google Ads prêt (${adsPlan.source === 'openai' ? 'généré par IA' : 'plan de secours déterministe'}) · conservé dans le rapport du store`,
        data: { adsPlanSource: adsPlan.source, campaignId: staged.campaignId, variantId: staged.variantId },
      });

      // Persist the full run report (suppliers, produits, assets, plan ads,
      // logs) via the existing platform_settings mechanism — no migration.
      const reportSaved = await saveStoreReport(db, report);
      if (reportSaved) {
        emit({ type: 'progress', message: 'Rapport de run persisté (fournisseurs, risques, plan ads, logs)' });
      }

      // Evaluate readiness and update final status
      emit({ type: 'step', message: 'Validation finale du store...' });
      await db.query(
        `UPDATE dropship_stores SET status = 'validating', updated_at = now() WHERE id = $1`,
        [storeId],
      );

      // endOfRun: the transitory 'validating' status we just set must not count
      // as a blocker against ourselves — evaluate the REAL state of the store.
      const readiness = await evaluateStoreReadiness(storeId, { endOfRun: true });
      const finalStatus = readiness.canPublish ? 'ready' : 'needs_repair';

      await db.query(
        `UPDATE dropship_stores
         SET status = $1, readiness_score = $2, updated_at = now()
         WHERE id = $3`,
        [finalStatus, readiness.score, storeId],
      );

      emit({
        type: 'success',
        message: `✅ "${input.storeName}" créé avec ${imported} produit${imported > 1 ? 's' : ''} ! Readiness: ${readiness.score}/100 · Statut: ${finalStatus}`,
        data: {
          storeId, slug, storeName: input.storeName, productCount: imported, mode, url: `/shop/${slug}`,
          adsPlan: { source: adsPlan.source, dailyBudgetEur: adsPlan.dailyBudgetEur, countries: adsPlan.countries },
          medusaOnline: medusaOk,
          readiness,
        },
      });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      const structured = (err instanceof Error && 'details' in err)
        ? (err as Error & { details?: JsonExtractionError }).details
        : null;

      if (report.storeId) {
        await persistStructuredError(db, report.storeId, 'failed', msg, structured);
      }
      emit({ type: 'error', message: msg });
      // Persist what we have — a failed run must still be inspectable.
      if (report.storeId) await saveStoreReport(db, report);
    }

    done = true;
    emit({ type: 'done', message: 'Agent terminé' });
  };

  run();

  while (true) {
    if (events.length > 0) {
      yield events.shift()!;
    } else if (done) {
      return;
    } else {
      await new Promise<void>(resolve => {
        if (events.length > 0) return resolve();
        resolveNext = (result) => {
          events.push(result.value);
          resolve();
        };
      });
    }
  }
}
