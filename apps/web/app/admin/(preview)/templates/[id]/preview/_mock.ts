/**
 * Mock data for template preview pages.
 * No DB, no network. Self-contained fake store + products shaped exactly
 * as the real Storefront components expect.
 */

import type { StoreConfig } from "@/lib/store-config";
import type { StoreProduct, StoreVariant } from "@/lib/medusa-store";

/** Picsum-style placeholder images (deterministic by seed, no tracking). */
const PLACEHOLDER_IMAGES = [
  "https://picsum.photos/seed/prod1/800/800",
  "https://picsum.photos/seed/prod2/800/800",
  "https://picsum.photos/seed/prod3/800/800",
  "https://picsum.photos/seed/prod4/800/800",
  "https://picsum.photos/seed/prod5/800/800",
  "https://picsum.photos/seed/prod6/800/800",
];

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
): StoreProduct {
  return {
    id: `mock-product-${n}`,
    title,
    subtitle: null,
    description,
    handle: `mock-product-${n}`,
    thumbnail: PLACEHOLDER_IMAGES[n % PLACEHOLDER_IMAGES.length],
    images: [{ url: PLACEHOLDER_IMAGES[n % PLACEHOLDER_IMAGES.length] }],
    variants: [mockVariant(`mock-variant-${n}`, price)],
    collection_id: null,
    tags: [],
  };
}

export const MOCK_PRODUCTS: StoreProduct[] = [
  mockProduct(
    0,
    "Essence Lumineuse",
    "Sérum éclat à l'huile de rosier. Texture fondante, parfum naturel délicat.",
    4900,
  ),
  mockProduct(
    1,
    "Crème Velours",
    "Hydratation intense 72h. Formule vegan certifiée. Peaux sensibles et normales.",
    3500,
  ),
  mockProduct(
    2,
    "Ritual Masque",
    "Masque purifiant à l'argile blanche. Pores affinés, teint unifié en 15 minutes.",
    2800,
  ),
  mockProduct(
    3,
    "Élixir Nuit",
    "Concentré repulpant nocturne. Active la régénération cellulaire pendant le sommeil.",
    5900,
  ),
  mockProduct(
    4,
    "Brume Protectrice",
    "Voile protecteur UV 30. Fixateur de maquillage et soin en un geste.",
    2200,
  ),
  mockProduct(
    5,
    "Baume Lèvres",
    "Soin lèvres fondant à la cire d'abeille et miel de manuka. 100% naturel.",
    1500,
  ),
];

export function buildMockStore(templateId: string, label: string): StoreConfig {
  return {
    id: "mock-store-preview",
    slug: `preview-${templateId}`,
    name: "Maison Preview",
    niche: "beauté & soin",
    tagline: "La beauté authentique, simplifiée.",
    description:
      "Une sélection rigoureuse de soins naturels pour sublimer votre routine quotidienne.",
    primaryColor: "#18181b",
    secondaryColor: "#f4f4f5",
    accentColor: "#a855f7",
    logoEmoji: "✦",
    medusaSalesChannelId: "",
    medusaPublishableKey: "",
    status: "ready",
    productCount: MOCK_PRODUCTS.length,
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
    heroImageUrl: "https://picsum.photos/seed/hero-store/1200/800",
    cutoutImageUrl: null,
    lifestyleImages: [
      "https://picsum.photos/seed/life1/800/800",
      "https://picsum.photos/seed/life2/800/800",
      "https://picsum.photos/seed/life3/800/800",
    ],
    promoVideoUrl: null,
    assetsStatus: "ready",
    template: templateId as StoreConfig["template"],
    customDomain: null,
    designPreset: null,
    palette: null,
    landingContent: {
      hero: {
        kicker: `Aperçu · ${label}`,
        headline_html: "La beauté, <em>réinventée</em>.",
        lede: "Des formules soigneusement élaborées pour une peau éclatante au naturel.",
      },
      selling_points: [
        {
          title: "Ingrédients naturels",
          body: "Formules 95% naturelles, sans perturbateurs endocriniens ni huiles minérales.",
        },
        {
          title: "Livraison 48h",
          body: "Expédition le jour même pour les commandes passées avant 14h.",
        },
        {
          title: "Satisfait ou remboursé",
          body: "30 jours pour changer d'avis, retours gratuits et sans question.",
        },
      ],
      showcase: {
        kicker: "Notre philosophie",
        headline_html: "Beauté <strong>consciente</strong>.",
        lede: "Chaque produit est développé en partenariat avec des dermatologues et formulé sans compromis.",
      },
      trust_promises: [
        {
          title: "Certifié vegan",
          body: "Aucun ingrédient d'origine animale, aucun test sur les animaux.",
        },
        {
          title: "Packaging recyclé",
          body: "Tous nos emballages sont fabriqués en plastique recyclé ou en verre.",
        },
        {
          title: "Made in France",
          body: "Formulé et produit en France, sous contrôle qualité strict.",
        },
        {
          title: "Dermatologiquement testé",
          body: "Cliniquement testé sur peaux sensibles. Résultats mesurés après 28 jours.",
        },
      ],
      final_cta: {
        kicker: "Rejoignez la communauté",
        headline_html: "Commencez votre <em>rituel</em>.",
        lede: "Découvrez la gamme complète et trouvez votre routine idéale.",
      },
    },
  };
}
