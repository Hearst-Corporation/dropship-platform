/**
 * Pattern scoring — utilité e-commerce dropship.
 *
 * `scorePatternForDropship(pattern, productContext)` renvoie un score 0–100 :
 * à quel point un pattern aide à VENDRE un produit physique en mono/mini-
 * collection. On récompense la mise en avant produit, le CTA clair, le mobile,
 * le support des objections/offre/preuve. On dégrade fortement les patterns
 * SaaS / portfolio / « concept Dribbble impossible » / dépendants d'assets
 * propriétaires / impossibles en mobile.
 *
 * Le score est déterministe (aucun aléatoire) et borné [0, 100].
 */
import type {
  ExtractedPattern,
  SanitizedPattern,
  PatternType,
  ProductContext,
} from './types';

export interface PatternScore {
  score: number;
  /** Contributions positives, pour la traçabilité admin. */
  positives: string[];
  /** Malus appliqués. */
  penalties: string[];
  /** true si le pattern est jugé exploitable (score >= 50). */
  usable: boolean;
}

/** Un pattern minimal scorable : les deux états partagent ces champs. */
type Scorable = Pick<
  ExtractedPattern,
  | 'patternType'
  | 'sectionOrder'
  | 'density'
  | 'ctaPlacement'
  | 'imageStrategy'
  | 'mobileBehavior'
> & { notes?: string; structuralDescription?: string; visualRhythm?: string };

/** Types de section directement utiles à une vente produit. */
const COMMERCE_POSITIVE: Record<PatternType, number> = {
  hero: 10,
  product_showcase: 14,
  benefit_grid: 10,
  specs: 8,
  comparison: 9,
  testimonial: 8,
  offer: 14,
  guarantee: 8,
  faq: 6,
  final_cta: 10,
  bundle: 10,
  before_after: 9,
  social_proof: 8,
  mobile_nav: 5,
};

/**
 * Signaux textuels (dans les notes/description structurelle) trahissant un
 * pattern NON e-commerce. On ne lit que les champs déjà sanitizés / structurels,
 * jamais du contenu source.
 */
const SAAS_SIGNALS = [
  /\bsaas\b/i,
  /\bdashboard\b/i,
  /\bpricing tier/i,
  /\bfree trial\b/i,
  /\bsign\s?up\b/i,
  /\bapp screenshot/i,
  /\bapi\b/i,
  /\bintegration/i,
  /\blogo cloud/i,
  /\bportfolio\b/i,
  /\bcase study\b/i,
  /\bmockup\b/i,
];

function textBlob(p: Scorable): string {
  return [p.notes, p.structuralDescription, p.visualRhythm]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function scorePatternForDropship(
  pattern: Scorable,
  ctx: ProductContext,
): PatternScore {
  const positives: string[] = [];
  const penalties: string[] = [];

  // Base neutre.
  let score = 40;

  // ── Utilité du type de section ──────────────────────────────────────────
  const typeBonus = COMMERCE_POSITIVE[pattern.patternType] ?? 0;
  score += typeBonus;
  if (typeBonus >= 10) positives.push(`type ${pattern.patternType} très vendeur`);

  // Montrer le produit compte : les stratégies image produit/lifestyle/gallery.
  if (['product_cutout', 'lifestyle', 'gallery', 'split', 'full_bleed'].includes(pattern.imageStrategy)) {
    score += 8;
    positives.push(`met le produit en scène (${pattern.imageStrategy})`);
  }
  if (pattern.imageStrategy === 'none' && pattern.patternType !== 'faq') {
    score -= 8;
    penalties.push('aucune image (mauvais pour un produit physique)');
  }

  // ── CTA clair ─────────────────────────────────────────────────────────────
  if (['above_fold', 'sticky_mobile', 'repeated'].includes(pattern.ctaPlacement)) {
    score += 8;
    positives.push(`CTA fort (${pattern.ctaPlacement})`);
  }

  // ── Mobile ─────────────────────────────────────────────────────────────────
  if (pattern.mobileBehavior === 'sticky_cta') {
    score += 8;
    positives.push('CTA sticky mobile');
  } else if (pattern.mobileBehavior === 'stacks_vertically' || pattern.mobileBehavior === 'collapses_to_accordion') {
    score += 4;
    positives.push('mobile propre');
  } else if (pattern.mobileBehavior === 'unknown') {
    score -= 4;
    penalties.push('comportement mobile inconnu');
  }

  // ── Objections / offre / preuve ────────────────────────────────────────────
  const supports = new Set(pattern.sectionOrder);
  if (supports.has('offer') || pattern.patternType === 'offer' || pattern.patternType === 'bundle') {
    score += 5;
    positives.push('supporte le prix/offre');
  }
  if (supports.has('faq') || supports.has('guarantee') || pattern.patternType === 'faq') {
    score += 4;
    positives.push('gère les objections');
  }
  if (supports.has('social_proof') || supports.has('testimonial') || supports.has('before_after')) {
    score += 4;
    positives.push('apporte une preuve visuelle/sociale');
  }

  // ── Contexte produit ───────────────────────────────────────────────────────
  if (!ctx.physical) {
    score -= 30;
    penalties.push('produit non physique — hors périmètre dropship');
  }
  if (ctx.mode === 'mono' && (pattern.patternType === 'bundle' || pattern.patternType === 'comparison')) {
    // Le bundle multi-produit colle mal au mono-produit strict.
    if (pattern.patternType === 'bundle') {
      score -= 10;
      penalties.push('bundle multi-produit peu compatible mono-produit');
    }
  }
  if (ctx.mode !== 'mono' && pattern.patternType === 'bundle') {
    score += 6;
    positives.push('bundle adapté à la mini-collection');
  }
  if (ctx.hasLifestyleImages === false && pattern.imageStrategy === 'lifestyle') {
    score -= 6;
    penalties.push('dépend d’images lifestyle indisponibles');
  }

  // ── Malus lourds : SaaS / portfolio / concept impossible ───────────────────
  const blob = textBlob(pattern);
  const saasHits = SAAS_SIGNALS.filter((re) => re.test(blob));
  if (saasHits.length) {
    score -= 25 + 5 * (saasHits.length - 1);
    penalties.push(`signaux SaaS/portfolio (${saasHits.length})`);
  }
  if (pattern.density === 'dense' && pattern.mobileBehavior === 'horizontal_scroll') {
    score -= 8;
    penalties.push('dense + scroll horizontal = fragile en mobile');
  }
  if (/decoratif|animation complexe|parallax|webgl|3d|canvas/i.test(blob)) {
    score -= 12;
    penalties.push('trop décoratif / difficile à reproduire proprement');
  }

  // Borne finale.
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, positives, penalties, usable: score >= 50 };
}

/**
 * Applique le score à un pattern (mute une copie) — pratique après extraction.
 */
export function withEcommerceScore<T extends Scorable>(
  pattern: T,
  ctx: ProductContext,
): T & { ecommerceUsefulnessScore: number } {
  const { score } = scorePatternForDropship(pattern, ctx);
  return { ...pattern, ecommerceUsefulnessScore: score };
}

/** Type guard pratique. */
export function isSanitized(p: ExtractedPattern | SanitizedPattern): p is SanitizedPattern {
  return 'structuralDescription' in p;
}
