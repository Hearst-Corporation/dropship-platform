/**
 * Static reference data for the "product opportunity discovery" feature.
 *
 * This is the candidate pool an operator's "find me the best product to
 * launch right now" request scans: ~40 concrete, sourceable dropship product
 * niches (more granular than the 17 broad `TemplateNiche` tags used by the
 * storefront template catalog). No scoring logic lives here — this file is
 * pure reference data consumed by downstream scoring code that queries
 * Google Ads Keyword Planner with `seedKeywords` and cross-references
 * `seasonalTags` against the current calendar.
 *
 * Keep entries realistic: physical products this platform can actually
 * source from AliExpress/CJ (see lib/suppliers/), not services or digital
 * goods, and not generic placeholders.
 */

import type { TemplateNiche } from '@/lib/template-catalog';

export type SeasonalTag =
  | 'christmas' // Nov-Dec gifting spike
  | 'summer' // June-Aug (outdoor, travel, beach, hydration)
  | 'back-to-school' // Aug-Sep (kids, tech, organization)
  | 'valentines' // early Feb (gifting, jewelry, beauty)
  | 'mothers-day' // late May/early June FR (gifting, beauty, home)
  | 'new-year' // Jan (fitness, wellness, organization — resolution-driven)
  | 'black-friday' // late Nov (broad, price-sensitive)
  | 'evergreen'; // no strong seasonality, stable year-round demand

export interface CandidateNiche {
  /** kebab-case slug, e.g. 'wireless-chargers' */
  id: string;
  /** French display label, e.g. "Chargeurs sans fil" */
  label: string;
  /** which of the 17 broad TemplateNiche tags this maps to */
  templateNiche: TemplateNiche;
  /** 2-4 French buying-intent seed keywords for Keyword Planner queries */
  seedKeywords: string[];
  /** commercial seasons this niche typically spikes for */
  seasonalTags: SeasonalTag[];
  /** typical retail price range (EUR) for dropship products in this niche */
  baselinePriceRangeEur: [number, number];
  /** optional 1-line French note on why this niche is interesting/risky */
  notes?: string;
}

export const CANDIDATE_NICHES: readonly CandidateNiche[] = [
  // ---- automotive ----
  {
    id: 'car-phone-mounts',
    label: 'Supports téléphone voiture',
    templateNiche: 'automotive',
    seedKeywords: ['support téléphone voiture', 'support smartphone voiture magnétique'],
    seasonalTags: ['evergreen'],
    baselinePriceRangeEur: [12, 30],
    notes: 'Marché mature mais volume stable, concurrence élevée sur les prix.',
  },
  {
    id: 'car-vacuum-cleaners',
    label: 'Aspirateurs portables voiture',
    templateNiche: 'automotive',
    seedKeywords: ['aspirateur voiture portable', 'mini aspirateur auto sans fil'],
    seasonalTags: ['summer', 'evergreen'],
    baselinePriceRangeEur: [20, 55],
  },
  {
    id: 'car-led-ambient-lights',
    label: 'Rubans LED ambiance habitacle',
    templateNiche: 'automotive',
    seedKeywords: ['led intérieur voiture', 'ruban led ambiance auto app'],
    seasonalTags: ['christmas', 'evergreen'],
    baselinePriceRangeEur: [15, 40],
  },

  // ---- fashion ----
  {
    id: 'crossbody-bags',
    label: 'Sacs bandoulière tendance',
    templateNiche: 'fashion',
    seedKeywords: ['sac bandoulière femme tendance', 'petit sac crossbody cuir'],
    seasonalTags: ['evergreen', 'christmas'],
    baselinePriceRangeEur: [20, 60],
  },
  {
    id: 'oversized-sunglasses',
    label: 'Lunettes de soleil oversize',
    templateNiche: 'fashion',
    seedKeywords: ['lunettes de soleil oversize femme', 'lunettes soleil tendance 2026'],
    seasonalTags: ['summer'],
    baselinePriceRangeEur: [10, 35],
    notes: 'Très saisonnier, pic printemps/été uniquement.',
  },
  {
    id: 'minimalist-watches',
    label: 'Montres minimalistes unisexe',
    templateNiche: 'fashion',
    seedKeywords: ['montre minimaliste homme', 'montre femme cuir fine'],
    seasonalTags: ['christmas', 'evergreen'],
    baselinePriceRangeEur: [25, 80],
  },

  // ---- beauty ----
  {
    id: 'led-face-masks',
    label: 'Masques LED luminothérapie',
    templateNiche: 'beauty',
    seedKeywords: ['masque led visage anti-âge', 'luminothérapie masque facial'],
    seasonalTags: ['new-year', 'evergreen'],
    baselinePriceRangeEur: [40, 120],
    notes: 'Ticket élevé, nécessite preuve/allégations prudentes (cosmétique).',
  },
  {
    id: 'gua-sha-facial-tools',
    label: 'Outils gua sha et rouleaux de jade',
    templateNiche: 'beauty',
    seedKeywords: ['gua sha visage', 'rouleau jade massage visage'],
    seasonalTags: ['evergreen', 'mothers-day'],
    baselinePriceRangeEur: [8, 25],
  },
  {
    id: 'hair-curling-tools',
    label: 'Fers à boucler automatiques',
    templateNiche: 'beauty',
    seedKeywords: ['fer à boucler automatique', 'boucleur cheveux sans fil'],
    seasonalTags: ['christmas', 'evergreen'],
    baselinePriceRangeEur: [25, 70],
  },

  // ---- wellness ----
  {
    id: 'massage-guns',
    label: 'Pistolets de massage percussion',
    templateNiche: 'wellness',
    seedKeywords: ['pistolet de massage musculaire', 'appareil massage percussion sport'],
    seasonalTags: ['new-year', 'evergreen'],
    baselinePriceRangeEur: [35, 100],
  },
  {
    id: 'weighted-blankets',
    label: 'Couvertures lestées anti-stress',
    templateNiche: 'wellness',
    seedKeywords: ['couverture lestée adulte', 'couverture anti-stress lourde'],
    seasonalTags: ['christmas', 'evergreen'],
    baselinePriceRangeEur: [40, 90],
  },
  {
    id: 'acupressure-mats',
    label: 'Tapis d’acupression',
    templateNiche: 'wellness',
    seedKeywords: ['tapis acupression dos', 'tapis fakir douleurs dos'],
    seasonalTags: ['new-year', 'evergreen'],
    baselinePriceRangeEur: [15, 35],
  },

  // ---- health ----
  {
    id: 'posture-correctors',
    label: 'Correcteurs de posture',
    templateNiche: 'health',
    seedKeywords: ['correcteur de posture dos', 'redresse dos télétravail'],
    seasonalTags: ['new-year', 'evergreen'],
    baselinePriceRangeEur: [12, 30],
  },
  {
    id: 'blood-pressure-monitors',
    label: 'Tensiomètres connectés',
    templateNiche: 'health',
    seedKeywords: ['tensiomètre bras électronique', 'tensiomètre connecté maison'],
    seasonalTags: ['evergreen'],
    baselinePriceRangeEur: [25, 60],
    notes: 'Dispositif médical léger, vérifier conformité marquage CE avant sourcing.',
  },
  {
    id: 'compression-socks',
    label: 'Chaussettes de compression',
    templateNiche: 'health',
    seedKeywords: ['chaussettes de contention voyage', 'chaussettes compression circulation'],
    seasonalTags: ['summer', 'evergreen'],
    baselinePriceRangeEur: [10, 25],
  },

  // ---- home ----
  {
    id: 'kitchen-organizers',
    label: 'Organisateurs de cuisine modulables',
    templateNiche: 'home',
    seedKeywords: ['organisateur placard cuisine', 'rangement tiroir cuisine modulable'],
    seasonalTags: ['new-year', 'back-to-school', 'evergreen'],
    baselinePriceRangeEur: [10, 30],
  },
  {
    id: 'led-galaxy-projectors',
    label: 'Projecteurs LED galaxie chambre',
    templateNiche: 'home',
    seedKeywords: ['projecteur galaxie chambre', 'veilleuse projecteur étoiles'],
    seasonalTags: ['christmas'],
    baselinePriceRangeEur: [20, 50],
  },
  {
    id: 'silicone-kitchen-gadgets',
    label: 'Ustensiles de cuisine en silicone',
    templateNiche: 'home',
    seedKeywords: ['ustensiles cuisine silicone lot', 'spatule silicone antiadhésive'],
    seasonalTags: ['evergreen', 'christmas'],
    baselinePriceRangeEur: [8, 25],
  },
  {
    id: 'smart-plant-pots',
    label: 'Pots de plantes auto-arrosants',
    templateNiche: 'home',
    seedKeywords: ['pot auto arrosant plante', 'pot de fleur irrigation automatique'],
    seasonalTags: ['summer', 'evergreen'],
    baselinePriceRangeEur: [12, 35],
  },
  {
    id: 'robot-window-cleaners',
    label: 'Robots laveurs de vitres',
    templateNiche: 'home',
    seedKeywords: ['robot laveur de vitres', 'nettoyeur vitre automatique'],
    seasonalTags: ['evergreen'],
    baselinePriceRangeEur: [60, 150],
    notes: 'Ticket élevé, taux de retour à surveiller.',
  },

  // ---- pet ----
  {
    id: 'automatic-pet-feeders',
    label: 'Distributeurs de nourriture automatiques',
    templateNiche: 'pet',
    seedKeywords: ['distributeur croquettes automatique', 'gamelle automatique chat programmable'],
    seasonalTags: ['evergreen'],
    baselinePriceRangeEur: [30, 90],
  },
  {
    id: 'pet-grooming-gloves',
    label: 'Gants de toilettage pour animaux',
    templateNiche: 'pet',
    seedKeywords: ['gant de toilettage chien', 'brosse gant poils chat chien'],
    seasonalTags: ['evergreen'],
    baselinePriceRangeEur: [8, 18],
  },
  {
    id: 'pet-water-fountains',
    label: 'Fontaines à eau pour animaux',
    templateNiche: 'pet',
    seedKeywords: ['fontaine à eau chat', 'fontaine eau filtrante animaux'],
    seasonalTags: ['summer', 'evergreen'],
    baselinePriceRangeEur: [20, 45],
  },

  // ---- tech ----
  {
    id: 'wireless-chargers',
    label: 'Chargeurs sans fil',
    templateNiche: 'tech',
    seedKeywords: ['chargeur sans fil', 'chargeur induction téléphone'],
    seasonalTags: ['christmas', 'evergreen'],
    baselinePriceRangeEur: [15, 45],
  },
  {
    id: 'mini-projectors',
    label: 'Mini projecteurs portables',
    templateNiche: 'tech',
    seedKeywords: ['mini projecteur portable', 'projecteur vidéo pas cher chambre'],
    seasonalTags: ['christmas', 'summer'],
    baselinePriceRangeEur: [40, 120],
  },
  {
    id: 'bluetooth-earbuds',
    label: 'Écouteurs bluetooth sans fil',
    templateNiche: 'tech',
    seedKeywords: ['écouteurs bluetooth sans fil', 'oreillettes sans fil sport'],
    seasonalTags: ['christmas', 'evergreen', 'black-friday'],
    baselinePriceRangeEur: [15, 50],
    notes: 'Marché saturé, se différencier sur design ou niche sport.',
  },
  {
    id: 'smart-home-gadgets',
    label: 'Gadgets smart home',
    templateNiche: 'tech',
    seedKeywords: ['prise connectée wifi', 'ampoule connectée alexa'],
    seasonalTags: ['black-friday', 'evergreen'],
    baselinePriceRangeEur: [15, 40],
  },
  {
    id: 'phone-camera-lenses',
    label: 'Objectifs photo pour smartphone',
    templateNiche: 'tech',
    seedKeywords: ['objectif clip smartphone', 'lentille photo téléphone grand angle'],
    seasonalTags: ['evergreen'],
    baselinePriceRangeEur: [15, 35],
  },
  {
    id: 'portable-power-banks',
    label: 'Batteries externes compactes',
    templateNiche: 'tech',
    seedKeywords: ['batterie externe rapide', 'powerbank compacte voyage'],
    seasonalTags: ['summer', 'black-friday', 'evergreen'],
    baselinePriceRangeEur: [15, 40],
  },

  // ---- food ----
  {
    id: 'egg-cooker-gadgets',
    label: 'Cuiseurs à œufs électriques',
    templateNiche: 'food',
    seedKeywords: ['cuiseur à œufs électrique', 'appareil à œufs durs automatique'],
    seasonalTags: ['evergreen'],
    baselinePriceRangeEur: [15, 30],
  },
  {
    id: 'vegetable-spiralizers',
    label: 'Spiralizers de légumes',
    templateNiche: 'food',
    seedKeywords: ['spiralizer légumes', 'coupe légumes spirale courgette'],
    seasonalTags: ['new-year', 'evergreen'],
    baselinePriceRangeEur: [12, 28],
  },

  // ---- beverage ----
  {
    id: 'insulated-tumblers',
    label: 'Gourdes isothermes tendance',
    templateNiche: 'beverage',
    seedKeywords: ['gourde isotherme tendance', 'mug isotherme grande contenance'],
    seasonalTags: ['summer', 'new-year', 'evergreen'],
    baselinePriceRangeEur: [15, 40],
  },
  {
    id: 'portable-espresso-makers',
    label: 'Machines à expresso portables',
    templateNiche: 'beverage',
    seedKeywords: ['machine expresso portable', 'cafetière portable camping'],
    seasonalTags: ['summer', 'christmas'],
    baselinePriceRangeEur: [30, 70],
  },

  // ---- jewelry ----
  {
    id: 'engraved-name-necklaces',
    label: 'Colliers prénom personnalisés',
    templateNiche: 'jewelry',
    seedKeywords: ['collier prénom personnalisé', 'bijou personnalisé gravure'],
    seasonalTags: ['christmas', 'valentines', 'mothers-day'],
    baselinePriceRangeEur: [15, 45],
  },
  {
    id: 'stacking-rings-sets',
    label: 'Lots de bagues empilables',
    templateNiche: 'jewelry',
    seedKeywords: ['bagues empilables lot', 'anneaux fins acier inoxydable'],
    seasonalTags: ['christmas', 'valentines', 'evergreen'],
    baselinePriceRangeEur: [10, 25],
  },

  // ---- travel ----
  {
    id: 'packing-cubes',
    label: 'Cubes de rangement valise',
    templateNiche: 'travel',
    seedKeywords: ['cubes de rangement valise', 'organiseur bagage voyage'],
    seasonalTags: ['summer', 'evergreen'],
    baselinePriceRangeEur: [15, 35],
  },
  {
    id: 'neck-travel-pillows',
    label: 'Oreillers de voyage ergonomiques',
    templateNiche: 'travel',
    seedKeywords: ['oreiller de voyage ergonomique', 'coussin nuque avion'],
    seasonalTags: ['summer', 'christmas'],
    baselinePriceRangeEur: [15, 30],
  },
  {
    id: 'universal-travel-adapters',
    label: 'Adaptateurs de voyage universels',
    templateNiche: 'travel',
    seedKeywords: ['adaptateur prise voyage universel', 'adaptateur électrique international'],
    seasonalTags: ['summer', 'evergreen'],
    baselinePriceRangeEur: [12, 25],
  },

  // ---- events ----
  {
    id: 'led-party-decorations',
    label: 'Décorations LED pour soirées',
    templateNiche: 'events',
    seedKeywords: ['guirlande led fête', 'décoration lumineuse anniversaire'],
    seasonalTags: ['christmas', 'new-year'],
    baselinePriceRangeEur: [8, 25],
  },
  {
    id: 'photo-booth-props',
    label: 'Accessoires photobooth événementiel',
    templateNiche: 'events',
    seedKeywords: ['accessoires photobooth mariage', 'kit photo booth fête'],
    seasonalTags: ['summer', 'christmas'],
    baselinePriceRangeEur: [10, 30],
  },

  // ---- sport ----
  {
    id: 'resistance-bands-sets',
    label: 'Lots de bandes de résistance',
    templateNiche: 'sport',
    seedKeywords: ['bandes de résistance musculation', 'élastiques fitness lot'],
    seasonalTags: ['new-year', 'summer', 'evergreen'],
    baselinePriceRangeEur: [10, 25],
  },
  {
    id: 'yoga-accessories',
    label: 'Accessoires de yoga premium',
    templateNiche: 'sport',
    seedKeywords: ['tapis de yoga antidérapant', 'brique de yoga liège'],
    seasonalTags: ['new-year', 'summer'],
    baselinePriceRangeEur: [15, 40],
  },
  {
    id: 'running-waist-bags',
    label: 'Ceintures de course running',
    templateNiche: 'sport',
    seedKeywords: ['ceinture running téléphone', 'sac banane sport course à pied'],
    seasonalTags: ['summer', 'new-year'],
    baselinePriceRangeEur: [10, 25],
  },

  // ---- editorial ----
  {
    id: 'aesthetic-desk-accessories',
    label: 'Accessoires de bureau esthétiques',
    templateNiche: 'editorial',
    seedKeywords: ['accessoires bureau design', 'organiseur bureau minimaliste'],
    seasonalTags: ['back-to-school', 'evergreen'],
    baselinePriceRangeEur: [12, 35],
  },
  {
    id: 'reading-light-clips',
    label: 'Lampes de lecture clip design',
    templateNiche: 'editorial',
    seedKeywords: ['lampe de lecture clip livre', 'liseuse led rechargeable'],
    seasonalTags: ['christmas', 'evergreen'],
    baselinePriceRangeEur: [10, 25],
  },

  // ---- gifting ----
  {
    id: 'personalized-gift-boxes',
    label: 'Coffrets cadeaux personnalisés',
    templateNiche: 'gifting',
    seedKeywords: ['coffret cadeau personnalisé', 'box cadeau original anniversaire'],
    seasonalTags: ['christmas', 'valentines', 'mothers-day'],
    baselinePriceRangeEur: [20, 60],
  },
  {
    id: 'photo-print-cubes',
    label: 'Cubes photo souvenirs personnalisés',
    templateNiche: 'gifting',
    seedKeywords: ['cube photo personnalisé', 'cadeau souvenir photo led'],
    seasonalTags: ['christmas', 'valentines', 'mothers-day'],
    baselinePriceRangeEur: [15, 40],
  },

  // ---- kids ----
  {
    id: 'montessori-wooden-toys',
    label: 'Jouets en bois Montessori',
    templateNiche: 'kids',
    seedKeywords: ['jouet montessori bois', 'jeu éducatif bois enfant'],
    seasonalTags: ['christmas', 'back-to-school'],
    baselinePriceRangeEur: [15, 40],
  },
  {
    id: 'kids-projector-nightlights',
    label: 'Veilleuses projecteur pour enfants',
    templateNiche: 'kids',
    seedKeywords: ['veilleuse projecteur enfant', 'veilleuse bébé étoiles chambre'],
    seasonalTags: ['christmas', 'evergreen'],
    baselinePriceRangeEur: [15, 35],
  },
  {
    id: 'kids-backpacks-organizers',
    label: 'Cartables et organiseurs scolaires',
    templateNiche: 'kids',
    seedKeywords: ['cartable enfant ergonomique', 'trousse scolaire organisée'],
    seasonalTags: ['back-to-school'],
    baselinePriceRangeEur: [20, 50],
    notes: 'Fenêtre de vente très courte, concentrée sur août-septembre.',
  },
] as const;

/** Returns candidate niches that spike for the given commercial season. */
export function getNichesBySeasonalTag(tag: SeasonalTag): CandidateNiche[] {
  return CANDIDATE_NICHES.filter((niche) => niche.seasonalTags.includes(tag));
}

/** Returns candidate niches mapped to the given broad TemplateNiche tag. */
export function getNichesByTemplateNiche(niche: TemplateNiche): CandidateNiche[] {
  return CANDIDATE_NICHES.filter((candidate) => candidate.templateNiche === niche);
}
