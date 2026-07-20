/**
 * Templates storefront concrets — exprimés comme DONNÉES (TemplateBlueprint),
 * rendus par BlueprintRenderer. Aucune duplication de JSX : ajouter un template
 * = ajouter une entrée ici. Chaque template est structurellement DISTINCT
 * (ordre de blocs / densité / stratégie image / CTA différents), ce qui est
 * vérifié par blueprint-templates.test.ts.
 *
 * Les 3 premiers reproduisent fidèlement les templates factory existants
 * (mono-premium-tech, beauty-wellness-no-claims, pet-home-practical). Les 4
 * suivants sont de nouveaux registres premium dérivés des archétypes de
 * lib/storefront/inspiration/blueprint.ts (drama / editorial / impulse / bundle).
 *
 * Toute copie de repli est FACTUELLE (livraison, retours, paiement) — jamais
 * d'allégation santé, jamais de texte issu d'une source externe.
 */
import type { StoreConfig } from '@/lib/store-config';
import type { TemplateBlueprint } from './inspiration/types';

const FAQ_STANDARD = [
  { q: 'Quels sont les délais de livraison ?', a: 'Commande traitée sous 24 h, livraison suivie.' },
  { q: 'Puis-je retourner le produit ?', a: 'Oui, retours acceptés sous 30 jours.' },
  { q: 'La garantie est-elle incluse ?', a: 'Chaque commande est couverte par notre service après-vente.' },
];
const FAQ_SHORT = [
  { q: 'Facile à utiliser au quotidien ?', a: 'Oui, pensé pour la maison et un usage simple.' },
  { q: 'Livraison et retours ?', a: 'Expédition sous 24 h, retours acceptés 30 jours.' },
];
const OFFER_NOTE = 'Paiement sécurisé · Expédition suivie · Retours 30 jours';

// ─────────────────────────────────────────────────────────────────────────────

export const STOREFRONT_BLUEPRINTS: readonly TemplateBlueprint[] = [
  // 1 ── mono-premium-tech (reproduit l'existant) ─────────────────────────────
  {
    id: 'mono-premium-tech',
    name: 'Mono premium tech',
    niche: 'tech-gadget',
    mode: 'mono',
    heroStyle: 'split',
    contentDensity: 'dense',
    offerStrategy: 'late',
    proofStrategy: 'mixed',
    blockOrder: [
      { type: 'hero', variant: 'split', imageSlot: 'hero' },
      { type: 'benefits', kicker: 'Ce qui fait la différence', title: 'Pensé pour l’usage réel' },
      { type: 'specs', tone: 'dark', kicker: 'Fiche technique' },
      { type: 'comparison', fallback: { comparisonTheirs: 'Modèle générique' } },
      { type: 'proof', tone: 'muted', kicker: 'Avis & garanties', imageSlot: 'lifestyle_grid' },
      { type: 'offer', kicker: 'Offre', ctaLabel: 'Ajouter au panier', ctaHref: '/cart', note: OFFER_NOTE },
      { type: 'faq', fallback: { faq: FAQ_STANDARD } },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 0, productCutout: true, gallery: false },
    videoRequirements: { heroVideo: false, demoVideo: false },
    copySlots: ['hero.headline_html', 'hero.lede', 'selling_points', 'specs', 'trust_promises', 'final_cta.headline_html'],
    qaRules: ['specs non vides recommandées', 'pas de claim santé', 'comparaison factuelle'],
    derivedFromPatternIds: [],
  },

  // 2 ── beauty-wellness-no-claims (reproduit l'existant) ──────────────────────
  {
    id: 'beauty-wellness-no-claims',
    name: 'Beauty wellness (no claims)',
    niche: 'beauty',
    mode: 'mono',
    heroStyle: 'overlay',
    contentDensity: 'balanced',
    offerStrategy: 'late',
    proofStrategy: 'lifestyle',
    blockOrder: [
      { type: 'hero', variant: 'overlay', imageSlot: 'lifestyle0', ctaLabel: 'Découvrir' },
      { type: 'problem_solution', tone: 'muted', kicker: 'La différence', imageSlot: 'lifestyle1', fallback: { problem: 'Une routine compliquée, des gestes en trop.' } },
      { type: 'benefits', kicker: 'Les essentiels', title: 'Une routine simple, épurée' },
      { type: 'proof', tone: 'muted', kicker: 'Confiance', title: 'Adopté au quotidien', imageSlot: 'lifestyle_grid' },
      {
        type: 'objections',
        title: 'Ce que vous vous demandez',
        fallback: {
          objections: [
            { q: 'Est-ce simple à utiliser ?', a: 'Oui — pensé pour un usage quotidien sans effort.' },
            { q: 'Convient-il à mon usage ?', a: 'Conçu pour un usage lifestyle, sobre et polyvalent.' },
            { q: 'Et si ça ne me convient pas ?', a: 'Retours acceptés sous 30 jours, sans discussion.' },
          ],
        },
      },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart', note: 'Livraison suivie · Retours 30 jours' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 2, productCutout: false, gallery: true },
    videoRequirements: { heroVideo: false, demoVideo: false },
    copySlots: ['hero.headline_html', 'hero.lede', 'selling_points', 'trust_promises'],
    qaRules: ['AUCUNE allégation santé / médicale / thérapeutique', 'pas de fiche technique', 'preuve = lifestyle'],
    derivedFromPatternIds: [],
  },

  // 3 ── pet-home-practical (reproduit l'existant) ─────────────────────────────
  {
    id: 'pet-home-practical',
    name: 'Pet & home practical',
    niche: 'pet-home',
    mode: 'mono',
    heroStyle: 'split',
    contentDensity: 'balanced',
    offerStrategy: 'early',
    proofStrategy: 'lifestyle',
    blockOrder: [
      { type: 'hero', variant: 'split', imageSlot: 'hero', ctaLabel: 'Voir l’offre', ctaHref: '#offre' },
      { type: 'offer', kicker: 'L’offre', title: 'Tout ce qu’il faut, en une commande', ctaLabel: 'Ajouter au panier', ctaHref: '/cart', note: 'Expédition 24 h · Retours 30 jours' },
      { type: 'benefits', kicker: 'Pourquoi l’adopter', title: 'Pratique au quotidien' },
      { type: 'proof', tone: 'muted', kicker: 'Ils l’utilisent', imageSlot: 'lifestyle_grid' },
      { type: 'faq', fallback: { faq: FAQ_SHORT } },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 1, productCutout: true, gallery: false },
    videoRequirements: { heroVideo: false, demoVideo: false },
    copySlots: ['hero.headline_html', 'included_items', 'selling_points', 'trust_promises'],
    qaRules: ['offre tôt (price-led)', 'pas de claim santé'],
    derivedFromPatternIds: [],
  },

  // 4 ── sport-recovery-performance (NOUVEAU · archétype premium-product-drama) ─
  {
    id: 'sport-recovery-performance',
    name: 'Sport recovery & performance',
    niche: 'sport',
    mode: 'mono',
    heroStyle: 'overlay',
    contentDensity: 'dense',
    offerStrategy: 'late',
    proofStrategy: 'mixed',
    blockOrder: [
      { type: 'hero', variant: 'overlay', imageSlot: 'hero' },
      { type: 'showcase', kicker: 'En conditions réelles', imageSlot: 'product' },
      { type: 'benefits', kicker: 'Conçu pour performer', title: 'Ce que ça change à l’entraînement' },
      { type: 'transformation', kicker: 'Routine', title: 'Avant / avec', fallback: { problem: 'La séance, sans accessoire adapté.' } },
      { type: 'proof', tone: 'muted', kicker: 'Adopté par les sportifs', imageSlot: 'lifestyle_grid' },
      { type: 'offer', kicker: 'Offre', ctaLabel: 'Ajouter au panier', ctaHref: '/cart', note: OFFER_NOTE },
      { type: 'faq', fallback: { faq: FAQ_STANDARD } },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
      { type: 'sticky_cta', ctaLabel: 'Commander', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 2, productCutout: true, gallery: false },
    videoRequirements: { heroVideo: false, demoVideo: true },
    copySlots: ['hero.headline_html', 'hero.lede', 'selling_points', 'trust_promises', 'final_cta.headline_html'],
    qaRules: [
      'AUCUNE allégation santé (pas de « soulage la douleur », « anti-inflammatoire », « guérit »)',
      'performance = confort / usage, jamais médical',
      'CTA sticky mobile',
    ],
    derivedFromPatternIds: [],
  },

  // 5 ── fashion-accessory-editorial (NOUVEAU · archétype lifestyle-story) ──────
  {
    id: 'fashion-accessory-editorial',
    name: 'Fashion accessory editorial',
    niche: 'fashion',
    mode: 'mono',
    heroStyle: 'overlay',
    contentDensity: 'minimal',
    offerStrategy: 'late',
    proofStrategy: 'lifestyle',
    blockOrder: [
      { type: 'hero', variant: 'overlay', imageSlot: 'lifestyle0', ctaLabel: 'Découvrir' },
      { type: 'showcase', kicker: 'La pièce', imageSlot: 'lifestyle_grid' },
      { type: 'benefits', kicker: 'Les détails', title: 'Le soin dans chaque détail' },
      { type: 'proof', tone: 'muted', kicker: 'Porté au quotidien', imageSlot: 'lifestyle_grid' },
      { type: 'reassurance', kicker: 'Sérénité', tone: 'plain' },
      { type: 'offer', kicker: 'Commander', ctaLabel: 'Ajouter au panier', ctaHref: '/cart', note: 'Livraison suivie · Retours 30 jours' },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 3, productCutout: false, gallery: true },
    videoRequirements: { heroVideo: false, demoVideo: false },
    copySlots: ['hero.headline_html', 'hero.lede', 'selling_points', 'trust_promises'],
    qaRules: ['≥3 images lifestyle (éditorial)', 'densité minimale, aérée', 'pas de claim santé'],
    derivedFromPatternIds: [],
  },

  // 6 ── gadget-impulse-premium (NOUVEAU · archétype technical-spec, offre tôt) ─
  {
    id: 'gadget-impulse-premium',
    name: 'Gadget impulse premium',
    niche: 'gadget',
    mode: 'mono',
    heroStyle: 'split',
    contentDensity: 'dense',
    offerStrategy: 'early',
    proofStrategy: 'stats',
    blockOrder: [
      { type: 'hero', variant: 'split', imageSlot: 'hero' },
      { type: 'offer', kicker: 'Offre de lancement', ctaLabel: 'J’en profite', ctaHref: '/cart', note: OFFER_NOTE },
      { type: 'specs', tone: 'dark', kicker: 'En un coup d’œil' },
      { type: 'comparison', fallback: { comparisonTheirs: 'Alternative bas de gamme' } },
      { type: 'proof', tone: 'muted', kicker: 'Ils l’ont adopté', imageSlot: 'lifestyle_grid' },
      { type: 'faq', fallback: { faq: FAQ_STANDARD } },
      { type: 'final_cta', tone: 'accent', ctaHref: '/cart' },
      { type: 'sticky_cta', ctaLabel: 'J’en profite', ctaHref: '/cart' },
    ],
    imageRequirements: { hero: true, lifestyleMin: 0, productCutout: true, gallery: false },
    videoRequirements: { heroVideo: false, demoVideo: false },
    copySlots: ['hero.headline_html', 'selling_points', 'specs', 'included_items'],
    qaRules: ['offre above-fold + sticky', 'comparaison factuelle', 'pas de claim santé'],
    derivedFromPatternIds: [],
  },

  // 7 ── mini-collection-bundle (NOUVEAU · archétype bundle-offer) ──────────────
  {
    id: 'mini-collection-bundle',
    name: 'Mini collection bundle',
    niche: 'mini-collection',
    mode: 'mini_collection',
    heroStyle: 'split',
    contentDensity: 'balanced',
    offerStrategy: 'bundle',
    proofStrategy: 'guarantee',
    blockOrder: [
      { type: 'hero', variant: 'split', imageSlot: 'hero', ctaLabel: 'Voir le pack', ctaHref: '#offre' },
      { type: 'bundle', kicker: 'Le pack', title: 'Mieux ensemble', ctaLabel: 'Composer mon pack', ctaHref: '/cart', note: 'Livraison suivie · Retours 30 jours' },
      { type: 'comparison', fallback: { comparisonTheirs: 'À l’unité' } },
      { type: 'benefits', kicker: 'Pourquoi le pack', title: 'L’essentiel, réuni' },
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

export type StorefrontBlueprintId = (typeof STOREFRONT_BLUEPRINTS)[number]['id'];

export const STOREFRONT_BLUEPRINT_IDS: readonly string[] = STOREFRONT_BLUEPRINTS.map((b) => b.id);

const BY_ID = new Map(STOREFRONT_BLUEPRINTS.map((b) => [b.id, b]));

export function getBlueprint(id: string): TemplateBlueprint | undefined {
  return BY_ID.get(id);
}

/**
 * Choisit un blueprint storefront RÉEL depuis (template + niche + mode) du store.
 * Ordre spécifique → générique ; il n'existe pas de « mono recoloré générique » :
 * tout store retombe sur l'un des 7 templates structurellement distincts.
 * Préserve les mappings historiques (beauty / pet-home / mono par défaut).
 */
export function resolveBlueprint(
  store: Pick<StoreConfig, 'template' | 'niche' | 'mode'>,
): TemplateBlueprint {
  const s = `${store.template ?? ''} ${store.niche ?? ''}`.toLowerCase();

  // « accessoire » seul est ambigu (mode vs maison) → on s'appuie sur des mots
  // sans équivoque de mode.
  if (/\bmode\b|fashion|bijou|montre|v[êe]tement|foulard|\bsac\b|ceinture|lunettes|[ée]charpe/.test(s)) return BY_ID.get('fashion-accessory-editorial')!;
  if (/sport|fitness|gym|muscu|running|run\b|yoga|recovery|r[ée]cup|performance|entra[îi]nement/.test(s)) return BY_ID.get('sport-recovery-performance')!;
  if (/bundle|pack\b|coffret|mini[-\s]?collection|duo|trio|lot\b/.test(s)) return BY_ID.get('mini-collection-bundle')!;
  if (/gadget|gizmo|geek|gaming|tech[-\s]?accessoire|innovation/.test(s)) return BY_ID.get('gadget-impulse-premium')!;
  if (/beaut|wellness|bien-?[ée]tre|cosm|soin|skin|spa|serum|s[ée]rum/.test(s)) return BY_ID.get('beauty-wellness-no-claims')!;
  // Bornes de mots sur les courts (cat/dog/home) : sinon « catalogue » matche « cat ».
  if (/\bpet\b|animal|\bchats?\b|\bchiens?\b|\bdog\b|\bcat\b|\bhome\b|maison|foyer|cuisine|salon|gamelle|liti[èe]re/.test(s)) return BY_ID.get('pet-home-practical')!;

  // Collection multi-produits sans niche spécifique → bundle.
  if (store.mode === 'collection') return BY_ID.get('mini-collection-bundle')!;

  return BY_ID.get('mono-premium-tech')!;
}
