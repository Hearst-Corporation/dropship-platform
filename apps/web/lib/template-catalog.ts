/**
 * Single source of truth for storefront templates.
 *
 * Each entry describes a template available to the dropshipping platform.
 * The agent that creates a store reads this catalog to suggest a fit based on
 * the product's niche, register, and modality. The admin selector and the zod
 * validator at /api/agent/stores/:id PATCH also derive from this list.
 *
 * Adding a new template requires four things:
 *  1. Create or reuse a React layout in app/shop/[slug]/
 *  2. Append the entry below (id + metadata)
 *  3. Wire the render branch in lib/storefront-routing.tsx if needed
 *  4. Add the id to infra/postgres/029_template_catalog_full.sql CHECK
 */

export type TemplateNiche =
  | 'automotive'
  | 'fashion'
  | 'beauty'
  | 'wellness'
  | 'health'
  | 'home'
  | 'pet'
  | 'tech'
  | 'food'
  | 'beverage'
  | 'jewelry'
  | 'travel'
  | 'events'
  | 'sport'
  | 'editorial'
  | 'gifting'
  | 'kids';

export type TemplateRegister = 'mass' | 'premium' | 'luxury';
export type TemplateMode = 'mono' | 'collection' | 'editorial' | 'split';
export type TemplateMood =
  | 'minimal'
  | 'bold'
  | 'soft'
  | 'dark'
  | 'serif'
  | 'sans'
  | 'playful'
  | 'cinematic'
  | 'organic';

export interface TemplateCatalogEntry {
  id: string;
  label: string;
  hint: string;
  niches: TemplateNiche[];
  register: TemplateRegister;
  mode: TemplateMode;
  moods: TemplateMood[];
  minProducts: number;
  autoCandidate: boolean;
}

export const TEMPLATE_CATALOG: readonly TemplateCatalogEntry[] = [
  {
    id: 'auto',
    label: 'Auto',
    hint: '1 produit → mono, 2+ → grille',
    niches: [],
    register: 'mass',
    mode: 'split',
    moods: ['sans'],
    minProducts: 0,
    autoCandidate: false,
  },
  {
    id: 'mono',
    label: 'Mono-produit',
    hint: 'Landing DTC long-form, 1 SKU mis en scène',
    niches: ['tech', 'home', 'beauty', 'wellness'],
    register: 'premium',
    mode: 'mono',
    moods: ['sans', 'minimal'],
    minProducts: 1,
    autoCandidate: true,
  },
  {
    id: 'collection-grid',
    label: 'Collection grille',
    hint: 'Grille 4 colonnes classique',
    niches: ['fashion', 'home', 'jewelry', 'gifting', 'kids'],
    register: 'mass',
    mode: 'collection',
    moods: ['sans', 'minimal'],
    minProducts: 4,
    autoCandidate: true,
  },
  {
    id: 'collection-editorial',
    label: 'Collection éditoriale',
    hint: '3 à 6 pièces en sections alternées, ton narratif',
    niches: ['fashion', 'beauty', 'jewelry', 'home', 'editorial'],
    register: 'premium',
    mode: 'editorial',
    moods: ['serif', 'minimal'],
    minProducts: 3,
    autoCandidate: true,
  },
  {
    id: 'luxury-minimal',
    label: 'Luxury minimal',
    hint: 'Noir & blanc, typo Satoshi black, blanc généreux, photos pleine page',
    niches: ['fashion', 'jewelry', 'beauty', 'tech'],
    register: 'luxury',
    mode: 'editorial',
    moods: ['dark', 'minimal', 'sans'],
    minProducts: 1,
    autoCandidate: false,
  },
  {
    id: 'gen-z-bold',
    label: 'Gen-Z bold',
    hint: 'Couleur saturée full-bleed, gros titres, marquee, grain, motion',
    niches: ['fashion', 'beauty', 'kids', 'food', 'beverage'],
    register: 'mass',
    mode: 'collection',
    moods: ['bold', 'playful', 'sans'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'editorial-fashion',
    label: 'Editorial fashion',
    hint: 'Hero portrait pleine page, logotype serif, diptyque produits, grille Instagram',
    niches: ['fashion', 'editorial', 'beauty'],
    register: 'premium',
    mode: 'editorial',
    moods: ['serif', 'cinematic'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'wellness-soft',
    label: 'Wellness soft',
    hint: 'Hero photo + plates info slate-blue, Poppins light, grille 3x2, footer navy',
    niches: ['wellness', 'health', 'beauty', 'home', 'pet'],
    register: 'premium',
    mode: 'split',
    moods: ['soft', 'sans', 'minimal'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'luxury-mono',
    label: 'Luxury mono',
    hint: 'Mono-produit haut de gamme — Cormorant Garamond serif, palette ivoire/charbon, storytelling long, packaging signature, framing made-to-order',
    niches: ['fashion', 'jewelry', 'beauty', 'home', 'editorial', 'gifting'],
    register: 'luxury',
    mode: 'mono',
    moods: ['serif', 'minimal', 'cinematic'],
    minProducts: 1,
    autoCandidate: false,
  },
  // ============== Wix ingest batch — May 2026 ==============
  {
    id: 'wellness-serenity',
    label: 'Wellness serenity',
    hint: 'Spa apaisé, Cormorant Garamond serif teal sage, sections centrées et photos lifestyle douces.',
    niches: ['wellness', 'health', 'beauty'],
    register: 'premium',
    mode: 'split',
    moods: ['soft', 'serif', 'minimal'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'wellness-pulse',
    label: 'Wellness pulse',
    hint: 'Coach fitness énergique, Manrope navy + plate teal et accent lime hot, tuiles 3 cartes Réserver.',
    niches: ['wellness', 'health', 'sport'],
    register: 'premium',
    mode: 'split',
    moods: ['bold', 'sans', 'playful'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'wellness-dance',
    label: 'Wellness dance',
    hint: "Studio danse playful, Jockey One display italic, plates cyan peach lavender et CTA purple S'abonner.",
    niches: ['wellness', 'sport', 'kids', 'events'],
    register: 'mass',
    mode: 'editorial',
    moods: ['playful', 'bold', 'sans'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'wellness-studio',
    label: 'Wellness studio',
    hint: 'Salle de sport dark, Poppins Black + triptyque photo et plate blanche centrée, accent orange chaud.',
    niches: ['wellness', 'sport', 'health'],
    register: 'mass',
    mode: 'editorial',
    moods: ['bold', 'dark', 'cinematic'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'wellness-retreat',
    label: 'Wellness retreat',
    hint: 'Cormorant Garamond ExtraLight serif, hero océanique turquoise, CTA jaune signature, sub-line italique, contact form centré, footer turquoise.',
    niches: ['wellness', 'health'],
    register: 'premium',
    mode: 'split',
    moods: ['soft', 'serif', 'cinematic'],
    minProducts: 1,
    autoCandidate: false,
  },
  {
    id: 'wellness-fitness-blog',
    label: 'Wellness fitness blog',
    hint: 'Manrope Extrabold, soulignage lime fluo skewé, bandes catégorielles FITNESS / NUTRITION / MOTIVATION, cards photo + tuile éditoriale, footer noir.',
    niches: ['wellness', 'sport', 'health', 'editorial'],
    register: 'mass',
    mode: 'editorial',
    moods: ['bold', 'sans', 'playful'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'wellness-massage-quiet',
    label: 'Wellness massage quiet',
    hint: "Palette crème chaude + brun chocolat, Cormorant Garamond italique d'accent, liste de soins 3 zones, portrait rond Meet Your Therapist, footer cocoa profond.",
    niches: ['wellness', 'beauty', 'health'],
    register: 'premium',
    mode: 'split',
    moods: ['soft', 'serif', 'organic'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'wellness-onyx-gym',
    label: 'Wellness onyx gym',
    hint: 'Onyx black + magenta signature + cyan accent, Manrope Heavy uppercase, hero plein cadre sombre, blocs alternés cyan/onyx/magenta, strip équipements, form essai gratuit.',
    niches: ['wellness', 'sport', 'health'],
    register: 'mass',
    mode: 'collection',
    moods: ['bold', 'dark', 'sans'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'events-musicart',
    label: 'Events Musicart',
    hint: 'Scène concert dark avec blocs corail, Bebas Neue uppercase, liste agenda majuscule.',
    niches: ['events', 'editorial'],
    register: 'premium',
    mode: 'editorial',
    moods: ['bold', 'cinematic', 'dark'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'events-bouquet',
    label: 'Events Bouquet',
    hint: 'Photographie romantique, serif italique Cormorant, bandeau pastel mint, pull-quote centré.',
    niches: ['events', 'gifting'],
    register: 'premium',
    mode: 'editorial',
    moods: ['soft', 'serif', 'cinematic'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'events-arcadium',
    label: 'Events Arcadium',
    hint: 'Affiche cyberpunk, JetBrains Mono techy, accent néon jaune sur slab noir, fond lavande.',
    niches: ['events', 'tech'],
    register: 'premium',
    mode: 'editorial',
    moods: ['bold', 'dark', 'playful'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'events-summit',
    label: 'Events Summit',
    hint: 'Conference summit, Space Grotesk sur sage card avec grille pointillée, agenda slab dark + tickets jaune.',
    niches: ['events', 'editorial'],
    register: 'premium',
    mode: 'editorial',
    moods: ['bold', 'sans', 'organic'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'events-converge',
    label: 'Events Converge',
    hint: 'Webinaire marketing, cartes modulaires sur fond noir avec jaune et bleu, Manrope display.',
    niches: ['events', 'tech'],
    register: 'premium',
    mode: 'collection',
    moods: ['bold', 'playful', 'sans'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'fashion-boutique-1622',
    label: 'Fashion boutique 1622',
    hint: 'Boutique mode classique, hero serif Cormorant sur photo, header charcoal slim, grille 3 produits, footer 3 colonnes.',
    niches: ['fashion', 'editorial'],
    register: 'premium',
    mode: 'collection',
    moods: ['serif', 'minimal', 'soft'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'beauty-salon-2851',
    label: 'Beauty salon 2851',
    hint: 'Salon beauté champagne, hero serif Playfair sur fond crème, bande sombre 3 services, testimonial quote, grille looks.',
    niches: ['beauty', 'wellness'],
    register: 'premium',
    mode: 'editorial',
    moods: ['serif', 'soft', 'minimal'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'fiora-locks-wh1270',
    label: 'Fiora Locks',
    hint: 'Maison beauté luxe, Cormorant Garamond Light géant, fond crème, services en liste éditoriale numérotée, galerie portrait + 3 vignettes.',
    niches: ['beauty', 'wellness', 'editorial'],
    register: 'luxury',
    mode: 'editorial',
    moods: ['serif', 'minimal', 'cinematic'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'adventure-travel-2787',
    label: 'Adventure travel 2787',
    hint: 'Tourisme aventure montagne, Montserrat bold blanc sur hero photo cinématique, panneau noir overlay liste tours et CTA rouge, journal 3 cartes sombres.',
    niches: ['travel', 'sport'],
    register: 'mass',
    mode: 'collection',
    moods: ['bold', 'cinematic', 'dark'],
    minProducts: 3,
    autoCandidate: false,
  },
  // ============== New template batch — July 2026 ==============
  {
    id: 'tech-modular',
    label: 'Tech modular',
    hint: 'Gadget high-tech dark par défaut, hero produit sur panneau charbon, tableau comparatif et grille de specs pour projecteurs, écouteurs et objets connectés.',
    niches: ['tech'],
    register: 'premium',
    mode: 'mono',
    moods: ['dark', 'sans', 'bold'],
    minProducts: 1,
    autoCandidate: true,
  },
  {
    id: 'pet-companion',
    label: 'Pet companion',
    hint: "Boutique pet playful et rassurante, photos animaux réelles, badges vétérinaire et grilles d'avis maîtres.",
    niches: ['pet'],
    register: 'mass',
    mode: 'collection',
    moods: ['playful', 'soft', 'organic'],
    minProducts: 3,
    autoCandidate: true,
  },
  {
    id: 'food-artisan',
    label: 'Artisan gourmet',
    hint: "Épicerie fine et cafés/thés de spécialité, macro-photo produit, storytelling de sourcing et récit d'atelier.",
    niches: ['food', 'beverage', 'gifting'],
    register: 'premium',
    mode: 'editorial',
    moods: ['organic', 'serif', 'soft'],
    minProducts: 3,
    autoCandidate: true,
  },
  {
    id: 'home-atelier',
    label: 'Home atelier',
    hint: 'Décoration et intérieur soft, photos en situation pièce par pièce et bloc shop the look.',
    niches: ['home'],
    register: 'premium',
    mode: 'collection',
    moods: ['soft', 'organic', 'serif'],
    minProducts: 3,
    autoCandidate: true,
  },
  {
    id: 'kids-playful',
    label: 'Kids playful',
    hint: "Boutique enfant/bébé rassurante, badges âge et pictos sécurité, mur d'avis parents.",
    niches: ['kids', 'gifting', 'home'],
    register: 'mass',
    mode: 'collection',
    moods: ['playful', 'soft', 'sans'],
    minProducts: 3,
    autoCandidate: true,
  },
  {
    id: 'orfevre-noir',
    label: 'Orfèvre Noir',
    hint: "Pièce unique orfèvrerie sur fond noir profond, scroll lent macro, sceau de certificat d'authenticité et sélecteur de taille.",
    niches: ['jewelry'],
    register: 'luxury',
    mode: 'mono',
    moods: ['dark', 'serif', 'cinematic'],
    minProducts: 1,
    autoCandidate: false,
  },
  {
    id: 'outdoor-summit-ridge',
    label: 'Outdoor Summit Ridge',
    hint: 'Matériel outdoor rugged, hero pleine largeur en terrain réel, callouts specs poids et étanchéité.',
    niches: ['sport', 'tech', 'travel'],
    register: 'mass',
    mode: 'collection',
    moods: ['bold', 'organic', 'sans'],
    minProducts: 3,
    autoCandidate: true,
  },
  {
    id: 'auto-garage',
    label: 'Garage',
    hint: 'Boutique gadgets auto, compatibilité véhicule mise en avant, esthétique carbone atelier.',
    niches: ['automotive'],
    register: 'mass',
    mode: 'collection',
    moods: ['dark', 'bold', 'sans'],
    minProducts: 3,
    autoCandidate: true,
  },
  {
    id: 'street-drop',
    label: 'Street drop',
    hint: 'Noir absolu, titres condensés géants, compte à rebours de drop et accent néon.',
    niches: ['fashion', 'sport', 'gifting'],
    register: 'mass',
    mode: 'collection',
    moods: ['bold', 'dark', 'sans'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'gift-curated',
    label: 'Coffret cadeau',
    hint: 'Coffrets et box cadeaux curés, navigation par occasion, contenu détaillé de chaque box.',
    niches: ['gifting'],
    register: 'premium',
    mode: 'collection',
    moods: ['soft', 'serif', 'organic'],
    minProducts: 4,
    autoCandidate: true,
  },
] as const;

export type StoreTemplate = (typeof TEMPLATE_CATALOG)[number]['id'];

export const TEMPLATE_IDS: readonly StoreTemplate[] = TEMPLATE_CATALOG.map(
  (t) => t.id as StoreTemplate,
);

export function getTemplateEntry(id: string): TemplateCatalogEntry | undefined {
  return TEMPLATE_CATALOG.find((t) => t.id === id);
}

/**
 * True when the template's register is 'luxury' — used by the asset
 * generator and landing-writer to switch to luxury prompts / voice instead
 * of the default DTC defaults. Unknown ids return false so the system
 * stays in the standard mode by default.
 */
export function isLuxuryTemplate(id: string | null | undefined): boolean {
  if (!id) return false;
  const entry = TEMPLATE_CATALOG.find((t) => t.id === id);
  return entry?.register === 'luxury';
}

/** Keyword → TemplateNiche mapping used to score a free-form niche string. */
const NICHE_KEYWORDS: ReadonlyArray<[TemplateNiche, RegExp]> = [
  ['automotive', /car|auto|vehicle|dash ?cam|voiture|véhicule|garage/i],
  ['wellness', /wellness|bien[- ]?être|aromath|spa|relax|zen|massage|méditation|meditation|yoga/i],
  ['beauty', /beauty|beauté|cosm[ée]t|skincare|soin|visage|makeup|maquillage/i],
  ['health', /health|santé|fitness|sport|muscu|gym/i],
  ['fashion', /fashion|mode|vêtement|vetement|apparel|streetwear/i],
  ['jewelry', /jewel|bijou|bague|collier|montre/i],
  ['home', /home|maison|déco|deco|interieur|intérieur|lampe|meuble/i],
  ['pet', /pet|animal|chien|chat|dog|cat/i],
  ['tech', /tech|gadget|électronique|electronique|audio|gaming|smart/i],
  ['kids', /kids|enfant|bébé|bebe|jouet|toy/i],
  ['food', /food|cuisine|gourmet|(?<![a-zà-ÿ])thé(?![a-zà-ÿ])|(?<![a-zà-ÿ])café|coffee|tea|snack/i],
  ['gifting', /cadeau|gift/i],
  ['sport', /sport|fitness|outdoor|randonnée|running/i],
];

/**
 * Deterministic template pick for the store-creator agent. Scores every
 * non-'auto' catalog entry against the niche keywords, the requested mode and
 * the product count, preferring premium register and richer layouts over the
 * plain grid. Always returns a usable template id — the plain 'collection-grid'
 * (or 'mono') only wins when nothing niche-specific matches.
 */
export function suggestTemplate(args: {
  niche: string;
  mode: 'mono' | 'collection';
  productCount: number;
  brief?: string | null;
}): StoreTemplate {
  const haystack = `${args.niche} ${args.brief ?? ''}`;
  const detected = new Set<TemplateNiche>(
    NICHE_KEYWORDS.filter(([, re]) => re.test(haystack)).map(([n]) => n),
  );

  let best: { id: StoreTemplate; score: number } | null = null;
  for (const t of TEMPLATE_CATALOG) {
    if (t.id === 'auto') continue;
    if (args.productCount < t.minProducts) continue;
    // Luxury register is operator-opt-in only (maison voice changes the copy).
    if (t.register === 'luxury') continue;

    let nicheScore = 0;
    for (const n of t.niches) if (detected.has(n)) nicheScore += 3;

    // Mode compatibility.
    //   - collection stores can't use a mono-only template (single-SKU layout).
    //   - mono stores prefer a mono-capable template, BUT a niche-matched
    //     richer template (editorial/split/collection) still gives the store
    //     its true identity: the storefront renders MonoProductLanding driven
    //     by the design preset regardless of the template's own mode. So in
    //     mono mode we only KEEP a non-mono template when it genuinely matches
    //     the niche (nicheScore > 0) — otherwise it's excluded and we fall back
    //     to a plain mono template.
    if (args.mode === 'collection' && t.mode === 'mono') continue;
    if (args.mode === 'mono' && t.mode !== 'mono' && nicheScore === 0) continue;

    let score = nicheScore;
    // Richness bonuses (register/mode/autoCandidate) only apply once a niche
    // actually matched, or when nothing was detected at all (pure fallback —
    // in that case richness alone should beat the plain grid). Without this
    // guard, a premium/editorial template with zero niche overlap could tie
    // or beat a mass-register template that genuinely matches the niche.
    if (score > 0 || detected.size === 0) {
      if (t.register === 'premium') score += 2;
      if (t.mode !== 'collection') score += 1; // richer layout than the plain grid
      if (t.autoCandidate) score += 1;
    }

    if (!best || score > best.score) best = { id: t.id as StoreTemplate, score };
  }

  return best?.id ?? (args.mode === 'mono' ? ('mono' as StoreTemplate) : ('collection-grid' as StoreTemplate));
}

