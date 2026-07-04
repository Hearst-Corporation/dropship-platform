/**
 * Mock data for template preview pages.
 * No DB, no network. Self-contained fake store + products shaped exactly
 * as the real Storefront components expect.
 *
 * Each template previews with content matched to its niche (kids, auto, pet,
 * food, …) AND its design preset, so the preview shows the template's true
 * identity instead of a generic beauty store. Templates without a bespoke
 * entry fall back to DEFAULT_CONTENT (beauty).
 */

import type { StoreConfig } from "@/lib/store-config";
import type { StoreProduct, StoreVariant } from "@/lib/medusa-store";

/** Picsum-style placeholder images (deterministic by seed, no tracking). */
function seededImages(seed: string): string[] {
  return Array.from({ length: 6 }, (_, i) => `https://picsum.photos/seed/${seed}-${i}/800/800`);
}

function mockVariant(id: string, price: number): StoreVariant {
  return {
    id,
    title: "Taille unique",
    sku: `SKU-${id}`,
    inventory_quantity: 99,
    calculated_price: {
      calculated_amount: price,
      original_amount: Math.round(price * 1.2),
      currency_code: "eur",
    },
  };
}

function mockProduct(
  n: number,
  title: string,
  description: string,
  price: number,
  image: string,
): StoreProduct {
  return {
    id: `mock-product-${n}`,
    title,
    subtitle: null,
    description,
    handle: `mock-product-${n}`,
    thumbnail: image,
    images: [{ url: image }],
    variants: [mockVariant(`mock-variant-${n}`, price)],
    collection_id: null,
    tags: [],
  };
}

interface ProductSeed {
  title: string;
  description: string;
  price: number;
}

interface NicheContent {
  /** Design preset slug — drives palette + fonts via resolveDesign(). */
  designPreset: string;
  niche: string;
  tagline: string;
  description: string;
  logoEmoji: string;
  imageSeed: string;
  primaryColor: string;
  accentColor: string;
  hero: { kicker: string; headline_html: string; lede: string };
  sellingPoints: { title: string; body: string }[];
  products: ProductSeed[];
}

const DEFAULT_CONTENT: NicheContent = {
  designPreset: "editorial-serif",
  niche: "beauté & soin",
  tagline: "La beauté authentique, simplifiée.",
  description:
    "Une sélection rigoureuse de soins naturels pour sublimer votre routine quotidienne.",
  logoEmoji: "✦",
  imageSeed: "beauty",
  primaryColor: "#18181b",
  accentColor: "#a855f7",
  hero: {
    kicker: "Nouveau · Soin naturel",
    headline_html: "La beauté, <em>réinventée</em>.",
    lede: "Des formules soigneusement élaborées pour une peau éclatante au naturel.",
  },
  sellingPoints: [
    { title: "Ingrédients naturels", body: "Formules 95% naturelles, sans perturbateurs endocriniens ni huiles minérales." },
    { title: "Livraison 48h", body: "Expédition le jour même pour les commandes passées avant 14h." },
    { title: "Satisfait ou remboursé", body: "30 jours pour changer d'avis, retours gratuits et sans question." },
  ],
  products: [
    { title: "Essence Lumineuse", description: "Sérum éclat à l'huile de rosier. Texture fondante, parfum naturel délicat.", price: 4900 },
    { title: "Crème Velours", description: "Hydratation intense 72h. Formule vegan certifiée. Peaux sensibles et normales.", price: 3500 },
    { title: "Ritual Masque", description: "Masque purifiant à l'argile blanche. Pores affinés, teint unifié en 15 minutes.", price: 2800 },
    { title: "Élixir Nuit", description: "Concentré repulpant nocturne. Active la régénération cellulaire pendant le sommeil.", price: 5900 },
    { title: "Brume Protectrice", description: "Voile protecteur UV 30. Fixateur de maquillage et soin en un geste.", price: 2200 },
    { title: "Baume Lèvres", description: "Soin lèvres fondant à la cire d'abeille et miel de manuka. 100% naturel.", price: 1500 },
  ],
};

/**
 * Per-template mock content. Keyed by template id. The design preset matches
 * each template's niche (see lib/design/presets.ts `suitedFor`). Templates not
 * listed here use DEFAULT_CONTENT.
 */
const TEMPLATE_CONTENT: Record<string, NicheContent> = {
  "kids-playful": {
    designPreset: "kids-crayon",
    niche: "enfant & bébé",
    tagline: "Des univers doux pour les tout-petits.",
    description: "Veilleuses, jouets d'éveil et accessoires pensés pour rassurer parents et enfants.",
    logoEmoji: "🧸",
    imageSeed: "kids",
    primaryColor: "#f6c445",
    accentColor: "#5b7cfa",
    hero: {
      kicker: "Chambre d'enfant · 0-6 ans",
      headline_html: "Des nuits <em>plus douces</em>.",
      lede: "Veilleuses en silicone souple, lumière apaisante et matières testées pour les petites mains.",
    },
    sellingPoints: [
      { title: "Silicone sans danger", body: "Matières souples certifiées sans BPA, testées pour la chambre de bébé." },
      { title: "Approuvé par les parents", body: "Des milliers d'avis de familles rassurées au moment du coucher." },
      { title: "Livraison rapide", body: "Expédié sous 24h, parce qu'un enfant n'attend pas." },
    ],
    products: [
      { title: "Veilleuse Nuage", description: "Lumière tamisée à intensité réglable. Silicone doux, rechargeable USB, tactile.", price: 2490 },
      { title: "Veilleuse Lapin", description: "Compagnon de nuit rassurant. 7 couleurs apaisantes, minuterie automatique.", price: 2790 },
      { title: "Tapis d'éveil Montessori", description: "Éveil sensoriel en coton bio. Motifs contrastés pour stimuler bébé.", price: 3990 },
      { title: "Mobile musical", description: "Berceuses douces et rotation lente. Fixation universelle sur lit à barreaux.", price: 3290 },
      { title: "Cube d'activités", description: "6 faces d'éveil : miroir, textures, sons. Bois et tissu, coins arrondis.", price: 2990 },
      { title: "Doudou attache-tétine", description: "Peluche ultra-douce avec attache sécurisée. Lavable en machine.", price: 1690 },
    ],
  },
  "pet-companion": {
    designPreset: "pet-playful",
    niche: "animaux de compagnie",
    tagline: "Le meilleur pour vos compagnons.",
    description: "Accessoires malins et confortables pour chiens et chats, pensés par des amoureux des animaux.",
    logoEmoji: "🐾",
    imageSeed: "pet",
    primaryColor: "#7a5c3e",
    accentColor: "#d98c3f",
    hero: {
      kicker: "Chiens & chats",
      headline_html: "Gâtez-les <em>comme il faut</em>.",
      lede: "Des accessoires du quotidien qui rendent la vie plus simple, pour eux comme pour vous.",
    },
    sellingPoints: [
      { title: "Testé par nos animaux", body: "Chaque produit approuvé par une équipe de chiens et chats exigeants." },
      { title: "Matières durables", body: "Résistant aux griffes, aux dents et aux lavages répétés." },
      { title: "Vétérinaire-friendly", body: "Sélection validée avec des vétérinaires partenaires." },
    ],
    products: [
      { title: "Brosse anti-poils", description: "Retire les poils morts en un geste. Réutilisable, lavable, multi-surfaces.", price: 1990 },
      { title: "Fontaine à eau", description: "Eau fraîche filtrée en continu. Silencieuse, 2L, incite à boire.", price: 3490 },
      { title: "Panier ergonomique", description: "Mousse à mémoire de forme. Housse déhoussable et lavable.", price: 4590 },
      { title: "Jouet interactif", description: "Distribue des friandises, stimule mentalement. Anti-ennui garanti.", price: 2290 },
      { title: "Harnais anti-traction", description: "Confortable et sécurisant. Réglable, réfléchissant, poignée de contrôle.", price: 2790 },
      { title: "Tapis de léchage", description: "Ralentit le repas, apaise le stress. Ventouses, silicone alimentaire.", price: 1590 },
    ],
  },
  "food-artisan": {
    designPreset: "gourmet-noir",
    niche: "épicerie fine",
    tagline: "Le goût de l'authentique.",
    description: "Produits d'artisans sélectionnés pour les amateurs de belles saveurs.",
    logoEmoji: "🥖",
    imageSeed: "food",
    primaryColor: "#2b2018",
    accentColor: "#c0873f",
    hero: {
      kicker: "Épicerie · Artisanat",
      headline_html: "Le goût, <em>sans compromis</em>.",
      lede: "Des produits d'exception, sourcés directement chez des artisans passionnés.",
    },
    sellingPoints: [
      { title: "Producteurs sélectionnés", body: "Chaque référence goûtée et validée avant d'entrer au catalogue." },
      { title: "Circuit court", body: "Directement de l'atelier à votre table, sans intermédiaire inutile." },
      { title: "Fraîcheur garantie", body: "Emballage isotherme et expédition express pour préserver les saveurs." },
    ],
    products: [
      { title: "Huile d'olive AOP", description: "Première pression à froid. Fruité intense, récolte du domaine.", price: 2490 },
      { title: "Miel de lavande", description: "Récolté en Provence. Cristallisation lente, arôme floral délicat.", price: 1890 },
      { title: "Chocolat grand cru", description: "70% Madagascar. Torréfaction artisanale, notes fruitées.", price: 990 },
      { title: "Terrine de canard", description: "Recette du Sud-Ouest. Cuisson lente, sans conservateur.", price: 1290 },
      { title: "Confiture de figue", description: "Cuite au chaudron. Morceaux entiers, faible en sucre.", price: 890 },
      { title: "Café de spécialité", description: "Origine Éthiopie, torréfié à la commande. Notes de fruits rouges.", price: 1490 },
    ],
  },
  "home-atelier": {
    designPreset: "home-linen",
    niche: "maison & déco",
    tagline: "L'art de vivre au quotidien.",
    description: "Objets et textiles choisis pour rendre chaque pièce plus chaleureuse.",
    logoEmoji: "🏡",
    imageSeed: "home",
    primaryColor: "#4a4038",
    accentColor: "#a88a6a",
    hero: {
      kicker: "Maison · Atelier",
      headline_html: "Votre intérieur, <em>sublimé</em>.",
      lede: "Des pièces intemporelles en matières naturelles pour un chez-soi apaisant.",
    },
    sellingPoints: [
      { title: "Matières nobles", body: "Lin lavé, céramique artisanale, bois massif. Rien de superflu." },
      { title: "Fait pour durer", body: "Des objets pensés pour traverser les années sans se démoder." },
      { title: "Emballage soigné", body: "Chaque commande préparée à la main, prête à offrir." },
    ],
    products: [
      { title: "Plaid en lin lavé", description: "Doux et respirant, teinture naturelle. Se patine joliment au fil du temps.", price: 5900 },
      { title: "Vase céramique", description: "Tourné à la main, émail mat. Chaque pièce est unique.", price: 3490 },
      { title: "Bougie parfumée", description: "Cire végétale, mèche en bois. Senteur bois de santal et vétiver.", price: 2290 },
      { title: "Set de table lin", description: "Lot de 4, lin épais. Bordures franges, lavable en machine.", price: 2790 },
      { title: "Panier tressé", description: "Fibres naturelles tressées main. Rangement déco pour toutes les pièces.", price: 3190 },
      { title: "Coussin velours", description: "Velours côtelé, garnissage moelleux. Housse déhoussable, teintes douces.", price: 2490 },
    ],
  },
  "tech-modular": {
    designPreset: "gadget-graphite",
    niche: "tech & gadgets",
    tagline: "La technologie qui simplifie.",
    description: "Accessoires connectés et gadgets malins, sélectionnés pour leur vraie utilité.",
    logoEmoji: "⚡",
    imageSeed: "tech",
    primaryColor: "#111318",
    accentColor: "#3b82f6",
    hero: {
      kicker: "Tech · Nouvelle génération",
      headline_html: "Le futur, <em>à portée de main</em>.",
      lede: "Des gadgets pensés pour vous faire gagner du temps, sans complexité inutile.",
    },
    sellingPoints: [
      { title: "Testé en conditions réelles", body: "Chaque produit éprouvé avant d'entrer au catalogue." },
      { title: "Compatible partout", body: "Standards universels : USB-C, Qi, Bluetooth 5.3." },
      { title: "Garantie 2 ans", body: "SAV réactif et pièces détachées disponibles." },
    ],
    products: [
      { title: "Chargeur MagSafe 3-en-1", description: "Recharge téléphone, montre et écouteurs. Pliable, voyage facile.", price: 4990 },
      { title: "Écouteurs ANC", description: "Réduction de bruit active. 30h d'autonomie, appairage instantané.", price: 5900 },
      { title: "Powerbank 20 000 mAh", description: "Charge rapide 65W. Recharge un laptop, écran de statut.", price: 3990 },
      { title: "Hub USB-C 7 ports", description: "HDMI 4K, lecteur SD, 3x USB. Aluminium, plug and play.", price: 3490 },
      { title: "Support téléphone magnétique", description: "Aimants N52, rotation 360°. Voiture, bureau, cuisine.", price: 1990 },
      { title: "Traqueur Bluetooth", description: "Retrouvez clés et sac. Portée 120m, pile remplaçable.", price: 2290 },
    ],
  },
  "auto-garage": {
    designPreset: "auto-carbon",
    niche: "automobile",
    tagline: "L'équipement qui fait la différence.",
    description: "Accessoires et équipements auto pour les passionnés qui prennent soin de leur véhicule.",
    logoEmoji: "🔧",
    imageSeed: "auto",
    primaryColor: "#17181a",
    accentColor: "#e63946",
    hero: {
      kicker: "Auto · Garage",
      headline_html: "Prenez soin de <em>votre machine</em>.",
      lede: "Des équipements sélectionnés pour la performance, l'entretien et le détail.",
    },
    sellingPoints: [
      { title: "Qualité atelier", body: "Matériel pro accessible, testé en garage." },
      { title: "Compatibilité vérifiée", body: "Filtres et pièces référencés par modèle." },
      { title: "Livraison suivie", body: "Expédition rapide, suivi en temps réel." },
    ],
    products: [
      { title: "Aspirateur sans fil", description: "Puissant et compact. Embouts pour recoins, batterie 30 min.", price: 4590 },
      { title: "Kit nettoyage détailing", description: "Microfibres, brosses, produits. Intérieur comme neuf.", price: 3290 },
      { title: "Support téléphone magnétique", description: "Fixation ventilation, aimants puissants. Recharge Qi intégrée.", price: 1990 },
      { title: "Compresseur portable", description: "Gonfle un pneu en 3 min. Écran digital, arrêt automatique.", price: 3990 },
      { title: "Organiseur de coffre", description: "Pliable, compartiments modulables. Antidérapant, robuste.", price: 2490 },
      { title: "Caméra de recul HD", description: "Vision nocturne, angle large. Installation sans fil.", price: 3590 },
    ],
  },
  "street-drop": {
    designPreset: "brutalist-luxe",
    niche: "streetwear",
    tagline: "Édition limitée. Impact maximal.",
    description: "Pièces streetwear en drops limités pour ceux qui refusent de passer inaperçus.",
    logoEmoji: "🔥",
    imageSeed: "street",
    primaryColor: "#0a0a0a",
    accentColor: "#eaff00",
    hero: {
      kicker: "Drop · Édition limitée",
      headline_html: "Sois <em>en avance</em>.",
      lede: "Des pièces produites en quantités limitées. Une fois parties, elles ne reviennent pas.",
    },
    sellingPoints: [
      { title: "Stock limité", body: "Chaque drop en série courte. Pas de réassort." },
      { title: "Coupe premium", body: "Coton lourd, sérigraphie durable, finitions soignées." },
      { title: "Expédition express", body: "Commande avant 15h, expédiée le jour même." },
    ],
    products: [
      { title: "Hoodie oversize", description: "Coton gratté 400g. Coupe boxy, capuche doublée.", price: 6900 },
      { title: "Tee sérigraphié", description: "Jersey épais, print résistant. Coupe droite unisexe.", price: 3490 },
      { title: "Cargo tactique", description: "Poches multiples, tissu ripstop. Coupe ajustée aux chevilles.", price: 7900 },
      { title: "Casquette brodée", description: "Structurée, broderie 3D. Fermeture réglable, visière plate.", price: 2990 },
      { title: "Sacoche crossbody", description: "Nylon technique, sangle large. Compartiment zippé sécurisé.", price: 3990 },
      { title: "Chaussettes pack x3", description: "Coton renforcé, logo tissé. Confort toute la journée.", price: 1790 },
    ],
  },
  "gift-curated": {
    designPreset: "gift-ribbon",
    niche: "cadeaux & coffrets",
    tagline: "Le cadeau qui touche juste.",
    description: "Des coffrets et idées cadeaux soigneusement composés pour chaque occasion.",
    logoEmoji: "🎁",
    imageSeed: "gift",
    primaryColor: "#3a2a2e",
    accentColor: "#c25e73",
    hero: {
      kicker: "Cadeaux · Coffrets",
      headline_html: "Offrez <em>l'émotion</em>.",
      lede: "Des coffrets pensés pour marquer les esprits, prêts à offrir sans effort.",
    },
    sellingPoints: [
      { title: "Emballage cadeau offert", body: "Chaque commande emballée avec soin, mot personnalisé possible." },
      { title: "Pour chaque occasion", body: "Naissance, anniversaire, remerciement : trouvez le bon coffret." },
      { title: "Livraison à date", body: "Choisissez le jour de livraison, arrivée garantie à temps." },
    ],
    products: [
      { title: "Coffret bien-être", description: "Bougie, thé, savon artisanal. Un moment de détente à offrir.", price: 4900 },
      { title: "Box gourmande", description: "Chocolats, biscuits, confiture. Sélection d'artisans français.", price: 3900 },
      { title: "Coffret naissance", description: "Body, doudou, carnet. Douceur pour accueillir bébé.", price: 5900 },
      { title: "Kit apéro", description: "Planche, tapenade, crackers. Tout pour un apéro réussi.", price: 4490 },
      { title: "Coffret thé & mug", description: "Sélection de thés, mug céramique. L'écrin des pauses cosy.", price: 3490 },
      { title: "Box créative", description: "Matériel loisirs créatifs. Pour occuper petits et grands.", price: 2990 },
    ],
  },
  "orfevre-noir": {
    designPreset: "jewel-mono",
    niche: "bijoux",
    tagline: "L'éclat de l'essentiel.",
    description: "Bijoux minimalistes en matières précieuses, pensés pour durer une vie.",
    logoEmoji: "◆",
    imageSeed: "jewelry",
    primaryColor: "#0f0f10",
    accentColor: "#c9a96a",
    hero: {
      kicker: "Bijoux · Made-to-last",
      headline_html: "L'essentiel, <em>sublimé</em>.",
      lede: "Des pièces épurées en acier inoxydable et plaqué or, résistantes à l'eau et au temps.",
    },
    sellingPoints: [
      { title: "Ne ternit pas", body: "Acier inoxydable et plaqué or 18k. Résistant à l'eau et à la sueur." },
      { title: "Design intemporel", body: "Des lignes épurées qui traversent les saisons." },
      { title: "Écrin offert", body: "Chaque bijou livré dans un écrin élégant, prêt à offrir." },
    ],
    products: [
      { title: "Collier maille fine", description: "Chaîne délicate, fermoir sécurisé. Se porte seul ou en superposition.", price: 3900 },
      { title: "Bracelet jonc", description: "Ligne épurée, ouverture réglable. Plaqué or résistant à l'eau.", price: 3490 },
      { title: "Boucles créoles", description: "Créoles fines et légères. Fermeture à clip confortable.", price: 2900 },
      { title: "Bague anneau", description: "Anneau lisse minimaliste. Se cumule à l'infini.", price: 2490 },
      { title: "Collier médaillon", description: "Pendentif gravable. Un bijou à personnaliser et transmettre.", price: 4500 },
      { title: "Chevalière", description: "Signet moderne, surface plane. Unisexe, plusieurs tailles.", price: 3990 },
    ],
  },
  "outdoor-summit-ridge": {
    designPreset: "trail-forge",
    niche: "outdoor & rando",
    tagline: "Équipé pour l'aventure.",
    description: "Matériel outdoor robuste pour la randonnée, le bivouac et les grands espaces.",
    logoEmoji: "⛰️",
    imageSeed: "outdoor",
    primaryColor: "#1e2a22",
    accentColor: "#e07a2f",
    hero: {
      kicker: "Outdoor · Randonnée",
      headline_html: "Prêt pour <em>le sommet</em>.",
      lede: "Un équipement testé sur le terrain, conçu pour tenir dans les conditions les plus rudes.",
    },
    sellingPoints: [
      { title: "Testé sur le terrain", body: "Matériel éprouvé en conditions réelles, montagne et bivouac." },
      { title: "Ultra-résistant", body: "Matières techniques imperméables et coutures renforcées." },
      { title: "Léger à porter", body: "Chaque gramme compte : compact et pensé pour le sac à dos." },
    ],
    products: [
      { title: "Gourde isotherme 1L", description: "Garde chaud 12h, froid 24h. Inox double paroi, incassable.", price: 2990 },
      { title: "Lampe frontale rechargeable", description: "500 lumens, étanche. Mode rouge vision nocturne, USB-C.", price: 3490 },
      { title: "Sac étanche 20L", description: "Roll-top, coutures soudées. Flotte, protège tout du déluge.", price: 3990 },
      { title: "Réchaud compact", description: "Se plie dans la poche. Allumage piézo, puissant par grand vent.", price: 2790 },
      { title: "Couteau multifonction", description: "12 outils, acier inoxydable. Compact, verrouillage sécurisé.", price: 3290 },
      { title: "Couverture de survie", description: "Réutilisable, ultra-compacte. Thermique, indispensable au sac.", price: 1490 },
    ],
  },
};

function contentFor(templateId: string): NicheContent {
  return TEMPLATE_CONTENT[templateId] ?? DEFAULT_CONTENT;
}

/** Products shaped for the given template's niche. */
export function mockProductsForTemplate(templateId: string): StoreProduct[] {
  const content = contentFor(templateId);
  const images = seededImages(content.imageSeed);
  return content.products.map((p, i) =>
    mockProduct(i, p.title, p.description, p.price, images[i % images.length]!),
  );
}

/** Legacy export kept for any caller still importing the flat list (beauty). */
export const MOCK_PRODUCTS: StoreProduct[] = mockProductsForTemplate("__default__");

export function buildMockStore(templateId: string, label: string): StoreConfig {
  const content = contentFor(templateId);
  const images = seededImages(content.imageSeed);
  return {
    id: "mock-store-preview",
    slug: `preview-${templateId}`,
    name: "Maison Preview",
    niche: content.niche,
    tagline: content.tagline,
    description: content.description,
    primaryColor: content.primaryColor,
    secondaryColor: "#f4f4f5",
    accentColor: content.accentColor,
    logoEmoji: content.logoEmoji,
    medusaSalesChannelId: "",
    medusaPublishableKey: "",
    status: "ready",
    productCount: content.products.length,
    runId: null,
    errorPhase: null,
    errorPath: null,
    errorExpected: null,
    errorReceived: null,
    errorRawExcerpt: null,
    readinessScore: 100,
    publishedAt: null,
    ga4MeasurementId: null,
    ga4ApiSecret: null,
    metaPixelId: null,
    metaCapiToken: null,
    tiktokPixelId: null,
    tiktokEventsToken: null,
    clarityId: null,
    googleAdsConversionAction: null,
    googleAdsMerchantId: null,
    mode: "collection",
    heroImageUrl: `https://picsum.photos/seed/${content.imageSeed}-hero/1200/800`,
    cutoutImageUrl: null,
    lifestyleImages: [images[0]!, images[1]!, images[2]!],
    promoVideoUrl: null,
    assetsStatus: "ready",
    template: templateId as StoreConfig["template"],
    customDomain: null,
    // The real driver of palette + fonts in resolveDesign().
    designPreset: content.designPreset,
    palette: null,
    landingContent: {
      hero: {
        kicker: content.hero.kicker,
        headline_html: content.hero.headline_html,
        lede: content.hero.lede,
      },
      selling_points: content.sellingPoints,
      showcase: {
        kicker: `Aperçu · ${label}`,
        headline_html: content.hero.headline_html,
        lede: content.description,
      },
      trust_promises: content.sellingPoints.map((sp) => ({ title: sp.title, body: sp.body })),
      final_cta: {
        kicker: "Prêt à commander ?",
        headline_html: content.hero.headline_html,
        lede: content.hero.lede,
      },
    },
  };
}
