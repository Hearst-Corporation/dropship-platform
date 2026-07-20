/**
 * Collector d'inspiration — LÉGAL par construction.
 *
 * Deux modes :
 *   A. URL mode — fetch d'une page PUBLIQUE simplement accessible, puis
 *      extraction de la STRUCTURE (ordre de sections, densité, présence CTA…).
 *   B. Manual capture — l'opérateur décrit les sections vues sur un screenshot ;
 *      on transforme sa description en pattern structurel (aucun OCR requis).
 *
 * Garde-fous NON négociables :
 *   - jamais de bypass login / paywall / captcha ;
 *   - jamais de scraping agressif (1 requête, timeout court, pas de retry en
 *     boucle, User-Agent honnête) ;
 *   - le HTML brut complet n'est JAMAIS retourné ni stocké comme template ;
 *   - les images/logos externes ne sont JAMAIS téléchargés comme assets ;
 *   - le résultat brut passe OBLIGATOIREMENT par sanitizeExtractedPattern avant
 *     tout stockage durable (ce module ne persiste rien).
 *
 * Sur blocage (401/403/429/login/paywall) : on s'arrête et on signale, on ne
 * contourne pas.
 */
import type {
  ExtractedPattern,
  InspirationSource,
  PatternType,
  Density,
  CtaPlacement,
  ImageStrategy,
  MobileBehavior,
} from './types';

export interface CollectResult {
  ok: boolean;
  /** Patterns extraits en état BRUT (à sanitizer avant stockage). */
  patterns: ExtractedPattern[];
  /** Raison d'arrêt si !ok (blocage, refus, indisponible). */
  reason?: string;
  status?: number;
}

/** URLs qu'on refuse d'aspirer par principe (accès protégé / sensible). */
const BLOCKED_PATH = /\/(login|signin|sign-in|account|checkout|cart|admin|wp-admin|my-account|password)\b/i;
const PAYWALL_HINTS = /(paywall|subscribe to read|members only|connectez-vous pour|abonnez-vous)/i;

interface CollectUrlOpts {
  sourceType: InspirationSource['sourceType'];
  nicheHint?: string | null;
  /** Injection pour les tests ; défaut = fetch global. */
  fetchImpl?: typeof fetch;
  /** id déterministe (pas de Date.now/random ici). */
  idPrefix?: string;
  timeoutMs?: number;
}

/**
 * Mode A — collecte depuis une URL publique. Ne suit pas les redirections vers
 * une page de login. Ne stocke jamais le HTML brut : il est analysé en mémoire
 * puis jeté.
 */
export async function collectFromUrl(
  url: string,
  opts: CollectUrlOpts,
): Promise<CollectResult> {
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  if (!doFetch) return { ok: false, patterns: [], reason: 'fetch indisponible' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, patterns: [], reason: 'URL invalide' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, patterns: [], reason: 'protocole non supporté' };
  }
  if (BLOCKED_PATH.test(parsed.pathname)) {
    return { ok: false, patterns: [], reason: 'chemin protégé/sensible — accès refusé par principe' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  let res: Response;
  try {
    res = await doFetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // User-Agent honnête, pas de spoof d'un navigateur pour contourner.
        'User-Agent': 'HearstStorefrontInspirationBot/1.0 (structure-only; no-asset-copy)',
        Accept: 'text/html',
      },
    });
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, patterns: [], reason: `réseau: ${(e as Error).message}` };
  }
  clearTimeout(timer);

  // Blocage → on NE contourne PAS.
  if (res.status === 401 || res.status === 403 || res.status === 429) {
    return { ok: false, patterns: [], reason: 'accès bloqué par le site — pas de contournement', status: res.status };
  }
  if (!res.ok) {
    return { ok: false, patterns: [], reason: `réponse ${res.status}`, status: res.status };
  }
  const ct = res.headers.get('content-type') ?? '';
  if (!/text\/html/i.test(ct)) {
    return { ok: false, patterns: [], reason: `type de contenu non-HTML (${ct})` };
  }

  const html = await res.text();
  if (PAYWALL_HINTS.test(html)) {
    return { ok: false, patterns: [], reason: 'contenu paywallé — non collecté' };
  }

  const patterns = extractPatternsFromHtml(html, {
    sourceId: parsed.hostname,
    idPrefix: opts.idPrefix ?? parsed.hostname.replace(/\W+/g, '-'),
    nicheHint: opts.nicheHint ?? null,
  });
  // Le HTML sort de portée ici : jamais retourné, jamais stocké.
  return { ok: true, patterns };
}

interface ExtractOpts {
  sourceId: string;
  idPrefix: string;
  nicheHint: string | null;
}

/**
 * Analyse HEURISTIQUE et légère de la structure d'une page. On ne construit pas
 * un DOM complet (pas de dépendance lourde) : on repère des repères de section
 * et on en déduit une signature structurelle. Le texte capturé va UNIQUEMENT
 * dans `raw` (que sanitize.ts supprime) — jamais dans les champs structurels.
 */
export function extractPatternsFromHtml(html: string, opts: ExtractOpts): ExtractedPattern[] {
  const lower = html.toLowerCase();

  // Repères de sections (approximatif, volontairement grossier).
  const sectionCount = (lower.match(/<section\b/g) || []).length;
  const headingTexts = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((m) => stripTagsRaw(m[1]))
    .filter(Boolean)
    .slice(0, 20);
  const imgCount = (lower.match(/<img\b/g) || []).length;
  const imageUrls = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .slice(0, 10);
  const hasForm = /<form\b/.test(lower);
  const hasStickyCta = /(sticky|fixed).{0,40}(add to cart|acheter|buy now|panier)/i.test(html);
  const priceHits = [...html.matchAll(/(?:[€$£]\s?\d[\d.,]*)|(?:\d[\d.,]*\s?(?:€|\$|£))/g)]
    .map((m) => m[0])
    .slice(0, 10);

  // Déduction de la densité.
  const density: Density = sectionCount >= 8 ? 'dense' : sectionCount >= 4 ? 'balanced' : 'minimal';

  // Déduction de l'ordre de sections (types génériques).
  const sectionOrder: PatternType[] = inferSectionOrder(headingTexts, { imgCount, hasForm });

  const ctaPlacement: CtaPlacement = hasStickyCta
    ? 'sticky_mobile'
    : /above the fold|hero.{0,40}cta|<a[^>]+class=["'][^"']*(btn|button|cta)/i.test(html)
      ? 'above_fold'
      : 'inline';

  const imageStrategy: ImageStrategy =
    imgCount === 0 ? 'none' : imgCount >= 6 ? 'gallery' : /background-image|object-cover|full-bleed|hero/i.test(html) ? 'full_bleed' : 'split';

  const mobileBehavior: MobileBehavior = hasStickyCta
    ? 'sticky_cta'
    : /@media[^{]*max-width/i.test(html)
      ? 'stacks_vertically'
      : 'unknown';

  const layoutSignature = `hero:${imageStrategy} · sections:${sectionCount} · cta:${ctaPlacement} · mobile:${mobileBehavior}`;

  const pattern: ExtractedPattern = {
    id: `${opts.idPrefix}-hero`,
    sourceId: opts.sourceId,
    patternType: 'hero',
    layoutSignature,
    sectionOrder,
    density,
    visualRhythm: density === 'dense' ? 'tight-stacked' : density === 'minimal' ? 'airy' : 'balanced',
    ctaPlacement,
    imageStrategy,
    mobileBehavior,
    ecommerceUsefulnessScore: 0, // rempli plus tard par le scorer
    notes: `Extrait structurel de ${opts.sourceId} (nicheHint: ${opts.nicheHint ?? 'n/a'})`,
    // RAW : tout ce qui est reconnaissable atterrit ici et SERA supprimé.
    raw: {
      sectionTitles: headingTexts,
      imageUrls,
      prices: priceHits,
    },
  };

  return [pattern];
}

/** Déduit un ordre de sections générique à partir des titres/indices. */
function inferSectionOrder(
  headings: string[],
  hints: { imgCount: number; hasForm: boolean },
): PatternType[] {
  const order: PatternType[] = ['hero'];
  const joined = headings.join(' | ').toLowerCase();

  if (hints.imgCount >= 2) order.push('product_showcase');
  if (/(benefit|avantage|pourquoi|feature|caractéristique)/.test(joined)) order.push('benefit_grid');
  if (/(spec|technique|dimension|détail)/.test(joined)) order.push('specs');
  if (/(vs|comparaison|compare|versus)/.test(joined)) order.push('comparison');
  if (/(avis|review|témoignage|testimonial|★|note)/.test(joined)) order.push('testimonial');
  if (/(before|après|avant|transformation)/.test(joined)) order.push('before_after');
  if (/(offre|offer|prix|price|bundle|pack)/.test(joined)) order.push('offer');
  if (/(garantie|guarantee|livraison|retour|shipping|return)/.test(joined)) order.push('guarantee');
  if (/(faq|question)/.test(joined)) order.push('faq');
  order.push('final_cta');
  return order;
}

function stripTagsRaw(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode B — capture manuelle (l'opérateur décrit ce qu'il voit)
// ─────────────────────────────────────────────────────────────────────────────

export interface ManualSectionInput {
  patternType: PatternType;
  /** Ce que l'opérateur note (ira dans raw, sera sanitizé). */
  operatorNote?: string;
  density?: Density;
  ctaPlacement?: CtaPlacement;
  imageStrategy?: ImageStrategy;
  mobileBehavior?: MobileBehavior;
}

export interface ManualCaptureInput {
  sourceId: string;
  idPrefix: string;
  nicheHint?: string | null;
  sections: ManualSectionInput[];
}

/**
 * Mode B — transforme une capture décrite manuellement en patterns structurels.
 * Pas d'OCR requis : on se fie à la description de l'opérateur. Le texte libre
 * de l'opérateur va dans `raw.slogans`/`raw.sectionTitles` et sera sanitizé.
 */
export function collectFromManualCapture(input: ManualCaptureInput): ExtractedPattern[] {
  const order = input.sections.map((s) => s.patternType);
  return input.sections.map((s, i) => ({
    id: `${input.idPrefix}-${s.patternType}-${i}`,
    sourceId: input.sourceId,
    patternType: s.patternType,
    layoutSignature: `${s.patternType} · ${s.imageStrategy ?? 'split'} · ${s.ctaPlacement ?? 'inline'}`,
    sectionOrder: order,
    density: s.density ?? 'balanced',
    visualRhythm: 'operator-described',
    ctaPlacement: s.ctaPlacement ?? 'inline',
    imageStrategy: s.imageStrategy ?? 'split',
    mobileBehavior: s.mobileBehavior ?? 'stacks_vertically',
    ecommerceUsefulnessScore: 0,
    notes: `Capture manuelle (nicheHint: ${input.nicheHint ?? 'n/a'})`,
    raw: s.operatorNote ? { sectionTitles: [s.operatorNote] } : undefined,
  }));
}
