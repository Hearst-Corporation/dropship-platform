/**
 * Blueprints — recettes de mise en page premium DTC, dérivées de patterns
 * SANITIZÉS. Un blueprint décrit un ORDRE de vrais blocs + une stratégie
 * (hero, densité, offre, preuve, images). Le renderer (BlueprintRenderer) lit
 * ces données ; aucune duplication de JSX par template.
 *
 * Ce fichier contient :
 *   - 5 archétypes nommés (§6 du brief) prêts à l'emploi ;
 *   - le mapping PatternType → BlockType (source → nos blocs) ;
 *   - generateBlueprintFromPatterns() : compose un blueprint à partir de
 *     patterns sanitizés + contexte produit ;
 *   - assertBlueprintBlocksExist() : garantit que chaque bloc référencé existe.
 */
import {
  BLOCK_TYPES,
  type BlockType,
  type BlockSpec,
  type PatternType,
  type ProductContext,
  type SanitizedPattern,
  type TemplateBlueprint,
} from './types';
import { scorePatternForDropship } from './scorer';

// ─────────────────────────────────────────────────────────────────────────────
// Mapping : un type de section observé (générique) → un de nos blocs réels.
// null = section qu'on n'implémente pas comme bloc dédié (ex: mobile_nav est un
// comportement porté par sticky_cta, pas une section autonome).
// ─────────────────────────────────────────────────────────────────────────────
export const PATTERN_TO_BLOCK: Record<PatternType, BlockType | null> = {
  hero: 'hero',
  product_showcase: 'showcase',
  benefit_grid: 'benefits',
  specs: 'specs',
  comparison: 'comparison',
  testimonial: 'proof',
  offer: 'offer',
  guarantee: 'reassurance',
  faq: 'faq',
  final_cta: 'final_cta',
  mobile_nav: 'sticky_cta',
  bundle: 'bundle',
  before_after: 'transformation',
  social_proof: 'proof',
};

const FACTUAL_FAQ: Array<{ q: string; a: string }> = [
  { q: 'Quels sont les délais de livraison ?', a: 'Commande traitée sous 24 h, livraison suivie.' },
  { q: 'Puis-je retourner le produit ?', a: 'Oui, retours acceptés sous 30 jours.' },
  { q: 'La commande est-elle garantie ?', a: 'Chaque commande est couverte par notre service après-vente.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5 archétypes (§6). Copie de repli STRICTEMENT factuelle (livraison/retours),
// aucune allégation santé, aucun texte issu d'une source.
// ─────────────────────────────────────────────────────────────────────────────

export const BLUEPRINT_ARCHETYPES: readonly TemplateBlueprint[] = [
  {
    id: 'premium-product-drama',
    name: 'Premium product drama',
    niche: 'gadget-premium',
    mode: 'mono',
    heroStyle: 'overlay',
    contentDensity: 'balanced',
    offerStrategy: 'late',
    proofStrategy: 'lifestyle',
    blockOrder: [
      { type: 'hero', variant: 'overlay', imageSlot: 'hero' },
      { type: 'showcase', tone: 'plain', imageSlot: 'product', kicker: 'En détail' },
      { type: 'benefits', kicker: 'Ce qui compte', title: 'Pensé pour l’usage réel' },
      { type: 'proof', tone: 'muted', kicker: 'Adopté au quotidien', imageSlot: 'lifestyle_grid' },
      { type: 'offer', kicker: 'Offre', ctaLabel: 'Ajouter au panier', ctaHref: '/cart', note: 'Paiement sécurisé · Expédition suivie · Retours 30 jours' },
      { type: 'faq', fallback: { faq: FACTUAL_FAQ } },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
      { type: 'sticky_cta', ctaLabel: 'Commander', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 2, productCutout: true, gallery: false },
    videoRequirements: { heroVideo: false, demoVideo: false },
    copySlots: ['hero.headline_html', 'hero.lede', 'selling_points', 'trust_promises', 'final_cta.headline_html'],
    qaRules: ['hero image obligatoire', 'pas de claim santé', 'CTA above-fold + sticky mobile'],
    derivedFromPatternIds: [],
  },
  {
    id: 'technical-spec-seller',
    name: 'Technical spec seller',
    niche: 'tech-gadget',
    mode: 'mono',
    heroStyle: 'split',
    contentDensity: 'dense',
    offerStrategy: 'late',
    proofStrategy: 'stats',
    blockOrder: [
      { type: 'hero', variant: 'split', imageSlot: 'hero' },
      { type: 'specs', tone: 'dark', kicker: 'Fiche technique' },
      { type: 'comparison', fallback: { comparisonTheirs: 'Modèle générique' } },
      { type: 'benefits', kicker: 'À l’usage', title: 'Ce que ça change concrètement' },
      { type: 'objections', title: 'Vos questions, sans détour' },
      { type: 'faq', fallback: { faq: FACTUAL_FAQ } },
      { type: 'offer', kicker: 'Offre', ctaLabel: 'Ajouter au panier', ctaHref: '/cart', note: 'Paiement sécurisé · Expédition suivie · Retours 30 jours' },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 0, productCutout: true, gallery: false },
    videoRequirements: { heroVideo: false, demoVideo: false },
    copySlots: ['hero.headline_html', 'hero.lede', 'specs', 'selling_points', 'trust_promises'],
    qaRules: ['specs non vides', 'comparaison factuelle (pas de dénigrement nommé)', 'pas de claim santé'],
    derivedFromPatternIds: [],
  },
  {
    id: 'lifestyle-story-commerce',
    name: 'Lifestyle story commerce',
    niche: 'home-lifestyle',
    mode: 'mono',
    heroStyle: 'overlay',
    contentDensity: 'balanced',
    offerStrategy: 'repeated',
    proofStrategy: 'mixed',
    blockOrder: [
      { type: 'hero', variant: 'overlay', imageSlot: 'lifestyle0' },
      { type: 'problem_solution', tone: 'muted', kicker: 'La différence', imageSlot: 'lifestyle1', fallback: { problem: 'Une routine compliquée, des gestes en trop.' } },
      { type: 'showcase', kicker: 'Au quotidien', imageSlot: 'lifestyle_grid' },
      { type: 'proof', tone: 'muted', kicker: 'Ils l’utilisent', imageSlot: 'lifestyle_grid' },
      { type: 'reassurance', kicker: 'Sérénité' },
      { type: 'offer', kicker: 'Offre', ctaLabel: 'Ajouter au panier', ctaHref: '/cart', note: 'Livraison suivie · Retours 30 jours' },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
      { type: 'sticky_cta', ctaLabel: 'Commander', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 3, productCutout: false, gallery: true },
    videoRequirements: { heroVideo: false, demoVideo: false },
    copySlots: ['hero.headline_html', 'hero.lede', 'selling_points', 'trust_promises'],
    qaRules: ['≥3 images lifestyle', 'pas de claim santé', 'preuve = lifestyle + réassurance'],
    derivedFromPatternIds: [],
  },
  {
    id: 'problem-solution-direct',
    name: 'Problem solution direct',
    niche: 'utility',
    mode: 'mono',
    heroStyle: 'split',
    contentDensity: 'balanced',
    offerStrategy: 'early',
    proofStrategy: 'testimonial',
    blockOrder: [
      { type: 'hero', variant: 'split', imageSlot: 'hero' },
      { type: 'problem_solution', tone: 'muted', kicker: 'Le problème', imageSlot: 'product', fallback: { problem: 'Le geste habituel, plus pénible qu’il ne devrait.' } },
      { type: 'transformation', kicker: 'Avant / après' },
      { type: 'benefits', kicker: 'Pourquoi ça marche', title: 'Simple, concret, efficace' },
      { type: 'offer', kicker: 'Offre', ctaLabel: 'Ajouter au panier', ctaHref: '/cart', note: 'Expédition 24 h · Retours 30 jours' },
      { type: 'faq', fallback: { faq: FACTUAL_FAQ } },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 1, productCutout: true, gallery: false },
    videoRequirements: { heroVideo: false, demoVideo: true },
    copySlots: ['hero.headline_html', 'selling_points', 'final_cta.headline_html'],
    qaRules: ['before/after non trompeur', 'pas de claim santé', 'offre tôt'],
    derivedFromPatternIds: [],
  },
  {
    id: 'bundle-offer-mini-collection',
    name: 'Bundle offer mini collection',
    niche: 'mini-collection',
    mode: 'mini_collection',
    heroStyle: 'split',
    contentDensity: 'balanced',
    offerStrategy: 'bundle',
    proofStrategy: 'guarantee',
    blockOrder: [
      { type: 'hero', variant: 'split', imageSlot: 'hero' },
      { type: 'bundle', kicker: 'Le pack', ctaLabel: 'Composer mon pack', ctaHref: '/cart' },
      { type: 'comparison', fallback: { comparisonTheirs: 'À l’unité' } },
      { type: 'benefits', kicker: 'Pourquoi le pack', title: 'Mieux ensemble' },
      { type: 'proof', tone: 'muted', kicker: 'Confiance', imageSlot: 'lifestyle_grid' },
      { type: 'reassurance', kicker: 'Sérénité' },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 1, productCutout: true, gallery: true },
    videoRequirements: { heroVideo: false, demoVideo: false },
    copySlots: ['hero.headline_html', 'selling_points', 'included_items', 'trust_promises'],
    qaRules: ['≥2 produits pour le bundle', 'prix pack cohérent', 'pas de claim santé'],
    derivedFromPatternIds: [],
  },
];

export function getArchetype(id: string): TemplateBlueprint | undefined {
  return BLUEPRINT_ARCHETYPES.find((b) => b.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation : chaque bloc référencé DOIT exister dans notre système de blocs.
// ─────────────────────────────────────────────────────────────────────────────
export function assertBlueprintBlocksExist(bp: TemplateBlueprint): string[] {
  const known = new Set<BlockType>(BLOCK_TYPES);
  const errors: string[] = [];
  if (bp.blockOrder.length === 0) errors.push(`${bp.id}: blockOrder vide`);
  for (const spec of bp.blockOrder) {
    if (!known.has(spec.type)) errors.push(`${bp.id}: bloc inconnu "${spec.type}"`);
  }
  // Un blueprint vendeur DOIT proposer au moins un hero et un CTA final.
  const types = new Set(bp.blockOrder.map((b) => b.type));
  if (!types.has('hero')) errors.push(`${bp.id}: pas de hero`);
  if (!types.has('final_cta') && !types.has('offer') && !types.has('bundle')) {
    errors.push(`${bp.id}: aucune conversion (offer/bundle/final_cta)`);
  }
  return errors;
}

/** Signature d'ordre de blocs — sert aux tests de différenciation. */
export function blockSignature(bp: TemplateBlueprint): string {
  return bp.blockOrder.map((b) => b.type).join('>');
}

/** Inverse (best-effort) de PATTERN_TO_BLOCK, pour re-scorer un blueprint. */
const BLOCK_TO_PATTERN: Record<BlockType, PatternType> = {
  hero: 'hero',
  problem_solution: 'benefit_grid',
  benefits: 'benefit_grid',
  showcase: 'product_showcase',
  specs: 'specs',
  comparison: 'comparison',
  proof: 'social_proof',
  transformation: 'before_after',
  objections: 'faq',
  reassurance: 'guarantee',
  offer: 'offer',
  bundle: 'bundle',
  faq: 'faq',
  final_cta: 'final_cta',
  sticky_cta: 'mobile_nav',
};

/**
 * Note e-commerce d'un template (0–100), pour l'UI admin : on reconstruit un
 * pattern représentatif à partir de la structure du blueprint et on le passe au
 * scorer. Déterministe.
 */
export function scoreBlueprint(bp: TemplateBlueprint, ctx: ProductContext): number {
  const hasSticky = bp.blockOrder.some((b) => b.type === 'sticky_cta');
  const early = bp.offerStrategy === 'early' || bp.offerStrategy === 'repeated' || bp.offerStrategy === 'bundle';
  return scorePatternForDropship(
    {
      patternType: 'offer',
      sectionOrder: bp.blockOrder.map((b) => BLOCK_TO_PATTERN[b.type]),
      density: bp.contentDensity,
      ctaPlacement: hasSticky ? 'sticky_mobile' : early ? 'above_fold' : 'end',
      imageStrategy: bp.heroStyle === 'overlay' ? 'full_bleed' : 'split',
      mobileBehavior: hasSticky ? 'sticky_cta' : 'stacks_vertically',
    },
    ctx,
  ).score;
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération : compose un blueprint à partir de patterns sanitizés + contexte.
// On part de l'archétype le mieux adapté au contexte, puis on réordonne les
// blocs selon l'ordre de sections le plus fréquent parmi les patterns fournis.
// ─────────────────────────────────────────────────────────────────────────────
export interface GeneratedBlueprint extends TemplateBlueprint {
  /** Score moyen d'utilité e-commerce des patterns sources. */
  sourceUsefulness: number;
}

export function generateBlueprintFromPatterns(
  patterns: SanitizedPattern[],
  ctx: ProductContext,
  opts: { id: string; name: string; niche: string } = {
    id: 'generated',
    name: 'Generated blueprint',
    niche: 'generic',
  },
): GeneratedBlueprint {
  // Choix de l'archétype de base selon le mode + la stratégie d'offre observée.
  const base =
    ctx.mode === 'mini_collection'
      ? getArchetype('bundle-offer-mini-collection')!
      : hasType(patterns, 'specs')
        ? getArchetype('technical-spec-seller')!
        : hasType(patterns, 'before_after')
          ? getArchetype('problem-solution-direct')!
          : ctx.hasLifestyleImages
            ? getArchetype('lifestyle-story-commerce')!
            : getArchetype('premium-product-drama')!;

  // Ordre de sections dominant (le plus long observé), mappé vers nos blocs.
  const dominant = [...patterns].sort((a, b) => b.sectionOrder.length - a.sectionOrder.length)[0];
  let blockOrder: BlockSpec[] = base.blockOrder;
  if (dominant && dominant.sectionOrder.length >= 4) {
    const mapped = dominant.sectionOrder
      .map((pt) => PATTERN_TO_BLOCK[pt])
      .filter((b): b is BlockType => b != null);
    // On réutilise les specs de blocs de l'archétype pour préserver la présentation.
    const byType = new Map(base.blockOrder.map((s) => [s.type, s]));
    const rebuilt = dedupeKeepOrder(mapped).map<BlockSpec>((t) => byType.get(t) ?? { type: t });
    if (!rebuilt.some((s) => s.type === 'hero')) rebuilt.unshift({ type: 'hero', variant: base.heroStyle, imageSlot: 'hero' });
    // Bloc de conversion propre à l'archétype : ne jamais le perdre au réordonnancement.
    if (ctx.mode === 'mini_collection' && !rebuilt.some((s) => s.type === 'bundle')) {
      rebuilt.splice(1, 0, byType.get('bundle') ?? { type: 'bundle', kicker: 'Le pack', ctaLabel: 'Composer mon pack', ctaHref: '/cart' });
    }
    if (!rebuilt.some((s) => s.type === 'final_cta')) rebuilt.push({ type: 'final_cta', tone: 'accent', ctaHref: '/cart' });
    blockOrder = rebuilt;
  }

  const usefulness =
    patterns.length > 0
      ? Math.round(patterns.reduce((s, p) => s + p.ecommerceUsefulnessScore, 0) / patterns.length)
      : 0;

  return {
    ...base,
    id: opts.id,
    name: opts.name,
    niche: opts.niche,
    mode: ctx.mode,
    blockOrder,
    derivedFromPatternIds: patterns.map((p) => p.id),
    sourceUsefulness: usefulness,
  };
}

function hasType(patterns: SanitizedPattern[], t: PatternType): boolean {
  return patterns.some((p) => p.patternType === t || p.sectionOrder.includes(t));
}

function dedupeKeepOrder<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}
