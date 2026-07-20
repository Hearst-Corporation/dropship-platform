/**
 * Inspiration intelligence — typed model.
 *
 * Ce module ne clone PAS de sites. Il extrait des STRUCTURES marketing
 * (rythme, hiérarchie, position CTA, densité, layout image/texte) pour nourrir
 * notre propre moteur de templates. Rien ici ne stocke de HTML/CSS/texte/images
 * d'une source : voir `sanitize.ts` (obligatoire avant tout stockage durable).
 *
 * Chaîne de vie d'un pattern :
 *   InspirationSource --collector--> ExtractedPattern --sanitize--> SanitizedPattern
 *   SanitizedPattern[] --blueprint--> TemplateBlueprint --renderer--> vrais blocs
 *
 * Tous les BlockType ci-dessous correspondent à un vrai bloc de
 * `components/storefront/blocks/` (ou à un bloc ajouté dans le même dossier) —
 * un blueprint ne peut donc jamais référencer un bloc qui n'existe pas.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulaire partagé
// ─────────────────────────────────────────────────────────────────────────────

/** Type de section marketing, indépendant de toute source. */
export type PatternType =
  | 'hero'
  | 'product_showcase'
  | 'benefit_grid'
  | 'specs'
  | 'comparison'
  | 'testimonial'
  | 'offer'
  | 'guarantee'
  | 'faq'
  | 'final_cta'
  | 'mobile_nav'
  | 'bundle'
  | 'before_after'
  | 'social_proof';

export const PATTERN_TYPES: readonly PatternType[] = [
  'hero',
  'product_showcase',
  'benefit_grid',
  'specs',
  'comparison',
  'testimonial',
  'offer',
  'guarantee',
  'faq',
  'final_cta',
  'mobile_nav',
  'bundle',
  'before_after',
  'social_proof',
] as const;

export type SourceType =
  | 'dribbble'
  | 'awwwards'
  | 'landbook'
  | 'shopify'
  | 'tailwind_plus'
  | 'manual_capture'
  | 'other';

/** Densité visuelle perçue d'une section / d'un template. */
export type Density = 'minimal' | 'balanced' | 'dense';

/** Où tombe le CTA principal dans la section. */
export type CtaPlacement =
  | 'above_fold'
  | 'inline'
  | 'after_proof'
  | 'sticky_mobile'
  | 'repeated'
  | 'end';

/** Stratégie d'image dominante d'une section. */
export type ImageStrategy =
  | 'none'
  | 'product_cutout'
  | 'lifestyle'
  | 'full_bleed'
  | 'split'
  | 'gallery'
  | 'before_after';

/** Comportement mobile notable. */
export type MobileBehavior =
  | 'stacks_vertically'
  | 'sticky_cta'
  | 'horizontal_scroll'
  | 'collapses_to_accordion'
  | 'hides_secondary'
  | 'unknown';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Source d'inspiration (référence, jamais du contenu copié)
// ─────────────────────────────────────────────────────────────────────────────

export interface InspirationSource {
  id: string;
  url: string;
  sourceType: SourceType;
  /** Catégorie éditoriale libre : "dtc-skincare", "tech-gadget"… */
  category: string;
  /** Niche produit visée par l'extraction, si connue. */
  nicheHint: string | null;
  /** ISO string. Passée explicitement (pas de Date.now() implicite). */
  capturedAt: string;
  notes: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Pattern extrait (état BRUT — potentiellement encore sale, à sanitizer)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedPattern {
  id: string;
  sourceId: string;
  patternType: PatternType;
  /**
   * Signature structurelle réutilisable, ex :
   *   "hero:split · image-right · cta-above-fold · reassurance-row"
   * Décrit la COMPOSITION, jamais le contenu.
   */
  layoutSignature: string;
  /** Ordre des sous-sections observées (types génériques uniquement). */
  sectionOrder: PatternType[];
  density: Density;
  /** Rythme vertical perçu : "tight" | "airy" | "editorial"… (libre). */
  visualRhythm: string;
  ctaPlacement: CtaPlacement;
  imageStrategy: ImageStrategy;
  mobileBehavior: MobileBehavior;
  /** 0–100, utilité e-commerce dropship (rempli par scorer.ts). */
  ecommerceUsefulnessScore: number;
  notes: string;

  /**
   * Champs POTENTIELLEMENT SALES — présents seulement dans l'état extrait,
   * TOUJOURS retirés par sanitizeExtractedPattern(). Optionnels : le collector
   * n'est pas obligé de les remplir, et il ne DOIT jamais y mettre des assets
   * réutilisables (images/logos), seulement des traces de détection.
   */
  raw?: {
    /** Titres de sections détectés, tels quels (contiennent du texte source). */
    sectionTitles?: string[];
    /** URLs d'images repérées (jamais téléchargées comme assets). */
    imageUrls?: string[];
    /** Noms de marques / personnes détectés. */
    brandNames?: string[];
    /** Classes CSS repérées. */
    cssClasses?: string[];
    /** Fragments HTML (jamais stockés comme template). */
    htmlSnippets?: string[];
    /** Prix concurrents repérés. */
    prices?: string[];
    /** Slogans / accroches. */
    slogans?: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pattern sanitizé (SEUL état autorisé au stockage durable / au blueprint)
// ─────────────────────────────────────────────────────────────────────────────

export interface SanitizedPattern {
  id: string;
  sourceId: string;
  patternType: PatternType;
  layoutSignature: string;
  sectionOrder: PatternType[];
  density: Density;
  visualRhythm: string;
  ctaPlacement: CtaPlacement;
  imageStrategy: ImageStrategy;
  mobileBehavior: MobileBehavior;
  ecommerceUsefulnessScore: number;
  /** Description transformée, structurelle uniquement (aucun texte source). */
  structuralDescription: string;
  notes: string;
  /**
   * Preuve d'assainissement : liste des catégories retirées + garantie que le
   * champ `raw` a disparu. Auditée par le test "no copied content".
   */
  sanitization: {
    removed: string[];
    /** Toujours true sur un SanitizedPattern valide. */
    rawStripped: true;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Blueprint de template (le moteur de rendu lit CECI, pas les sources)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type de bloc concret. CHAQUE valeur mappe vers un composant réel de
 * `components/storefront/blocks/`. Validé par blueprint.test.ts
 * (`assertBlueprintBlocksExist`).
 */
export type BlockType =
  | 'hero'
  | 'problem_solution'
  | 'benefits'
  | 'showcase'
  | 'specs'
  | 'comparison'
  | 'proof'
  | 'transformation'
  | 'objections'
  | 'reassurance'
  | 'offer'
  | 'bundle'
  | 'faq'
  | 'final_cta'
  | 'sticky_cta';

export const BLOCK_TYPES: readonly BlockType[] = [
  'hero',
  'problem_solution',
  'benefits',
  'showcase',
  'specs',
  'comparison',
  'proof',
  'transformation',
  'objections',
  'reassurance',
  'offer',
  'bundle',
  'faq',
  'final_cta',
  'sticky_cta',
] as const;

/** D'où un bloc tire son image, résolu contre StorefrontData au rendu. */
export type ImageSlot =
  | 'none'
  | 'hero'
  | 'product'
  | 'lifestyle0'
  | 'lifestyle1'
  | 'lifestyle_grid';

/**
 * Un bloc dans un blueprint : son type + des réglages de PRÉSENTATION.
 * Aucun texte marketing "vendeur" ici — seulement de la structure et des
 * libellés d'UI génériques (kicker, titre de section, libellé CTA). Le contenu
 * réel vient de `landing_content` (écrit par landing-writer) au rendu.
 */
export interface BlockSpec {
  type: BlockType;
  /** Variante de rendu du bloc (ex hero: 'split' | 'overlay'). */
  variant?: string;
  /** Fond de section : plain | muted | dark | accent. */
  tone?: 'plain' | 'muted' | 'dark' | 'accent';
  kicker?: string;
  title?: string;
  imageSlot?: ImageSlot;
  ctaLabel?: string;
  /** Ancre interne (#offre) ou route (/cart). */
  ctaHref?: string;
  note?: string;
  /**
   * Contenu de repli STRUCTUREL et FACTUEL (jamais de claim santé, jamais de
   * copie d'une source) utilisé quand landing_content ne fournit rien —
   * ex. items FAQ livraison/retours, libellé colonne comparaison.
   */
  fallback?: {
    faq?: Array<{ q: string; a: string }>;
    objections?: Array<{ q: string; a: string }>;
    comparisonTheirs?: string;
    problem?: string;
  };
}

export interface TemplateBlueprint {
  id: string;
  name: string;
  /** Niche cible (libre) : "tech-gadget", "beauty", "pet-home"… */
  niche: string;
  mode: 'mono' | 'collection' | 'mini_collection';
  /** L'ordre EST l'ordre du tableau ; chaque entrée porte son type. */
  blockOrder: BlockSpec[];
  heroStyle: 'split' | 'overlay';
  contentDensity: Density;
  /** Où / comment l'offre est présentée. */
  offerStrategy: 'early' | 'late' | 'bundle' | 'repeated';
  /** Comment la preuve est apportée. */
  proofStrategy: 'lifestyle' | 'testimonial' | 'guarantee' | 'stats' | 'mixed';
  imageRequirements: {
    hero: boolean;
    lifestyleMin: number;
    productCutout: boolean;
    gallery: boolean;
  };
  videoRequirements: {
    heroVideo: boolean;
    demoVideo: boolean;
  };
  /** Slots de copie que landing-writer doit remplir pour ce template. */
  copySlots: string[];
  /** Règles QA propres au template (compliance, claims, etc.). */
  qaRules: string[];
  /** Provenance : ids de SanitizedPattern ayant inspiré ce blueprint. */
  derivedFromPatternIds: string[];
}

/** Contexte produit passé au scorer pour pondérer l'utilité e-commerce. */
export interface ProductContext {
  /** Produit physique (true) vs immatériel / SaaS (false). */
  physical: boolean;
  mode: 'mono' | 'collection' | 'mini_collection';
  /** Niche libre, utilisée seulement pour des ajustements légers. */
  niche?: string;
  /** Le produit dispose-t-il d'images lifestyle exploitables ? */
  hasLifestyleImages?: boolean;
}
