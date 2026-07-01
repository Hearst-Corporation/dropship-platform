/**
 * Mock data for template preview pages.
 * No DB, no network. Self-contained fake store + products shaped exactly
 * as the real Storefront components expect.
 */

import type { StoreConfig } from '@/lib/store-config';
import type { StoreProduct, StoreVariant } from '@/lib/medusa-store';

/** Picsum-style placeholder images (deterministic by seed, no tracking). */
const PLACEHOLDER_IMAGES = [
  'https://picsum.photos/seed/prod1/800/800',
  'https://picsum.photos/seed/prod2/800/800',
  'https://picsum.photos/seed/prod3/800/800',
  'https://picsum.photos/seed/prod4/800/800',
  'https://picsum.photos/seed/prod5/800/800',
  'https://picsum.photos/seed/prod6/800/800',
];

function mockVariant(id: string, price: number): StoreVariant {
  return {
    id,
    title: 'Taille unique',
    sku: `SKU-${id}`,
    inventory_quantity: 99,
    calculated_price: {
      calculated_amount: price,
      original_amount: Math.round(price * 1.2),
      currency_code: 'eur',
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
  mockProduct(0, 'Essence Lumineuse', 'Serum eclat a l huile de rosier. Texture fondante, parfum naturel delicat.', 4900),
  mockProduct(1, 'Creme Velours', 'Hydratation intense 72h. Formule vegan certifiee. Peaux sensibles et normales.', 3500),
  mockProduct(2, 'Ritual Masque', 'Masque purifiant a l argile blanche. Pores affines, teint unifie en 15 minutes.', 2800),
  mockProduct(3, 'Elixir Nuit', 'Concentre repulpant nocturne. Active la regeneration cellulaire pendant le sommeil.', 5900),
  mockProduct(4, 'Brume Protectrice', 'Voile protecteur UV 30. Fixateur de maquillage et soin en un geste.', 2200),
  mockProduct(5, 'Baume Levres', 'Soin levres fondant a la cire d abeille et miel de manuka. 100% naturel.', 1500),
];

export function buildMockStore(templateId: string, label: string): StoreConfig {
  return {
    id: 'mock-store-preview',
    slug: `preview-${templateId}`,
    name: 'Maison Preview',
    niche: 'beaute & soin',
    tagline: 'La beaute authentique, simplifiee.',
    description: 'Une selection rigoureuse de soins naturels pour sublimer votre routine quotidienne.',
    primaryColor: '#18181b',
    secondaryColor: '#f4f4f5',
    accentColor: '#a855f7',
    logoEmoji: '✦',
    medusaSalesChannelId: '',
    medusaPublishableKey: '',
    status: 'active',
    productCount: MOCK_PRODUCTS.length,
    ga4MeasurementId: null,
    ga4ApiSecret: null,
    metaPixelId: null,
    metaCapiToken: null,
    tiktokPixelId: null,
    tiktokEventsToken: null,
    clarityId: null,
    googleAdsConversionAction: null,
    googleAdsMerchantId: null,
    mode: 'collection',
    heroImageUrl: 'https://picsum.photos/seed/hero-store/1200/800',
    cutoutImageUrl: null,
    lifestyleImages: [
      'https://picsum.photos/seed/life1/800/800',
      'https://picsum.photos/seed/life2/800/800',
      'https://picsum.photos/seed/life3/800/800',
    ],
    promoVideoUrl: null,
    assetsStatus: 'ready',
    template: templateId as StoreConfig['template'],
    customDomain: null,
    designPreset: null,
    palette: null,
    landingContent: {
      hero: {
        kicker: `Apercu — ${label}`,
        headline_html: 'La beaute, <em>reinventee</em>.',
        lede: 'Des formules soigneusement elaborees pour une peau eclatante au naturel.',
      },
      selling_points: [
        { title: 'Ingredients naturels', body: 'Formules 95% naturelles, sans perturbateurs endocriniens ni huiles minerales.' },
        { title: 'Livraison 48h', body: 'Expedition le jour meme pour les commandes passees avant 14h.' },
        { title: 'Satisfait ou rembourse', body: '30 jours pour changer d avis — retours gratuits et sans question.' },
      ],
      showcase: {
        kicker: 'Notre philosophie',
        headline_html: 'Beaute <strong>consciente</strong>.',
        lede: 'Chaque produit est developpe en partenariat avec des dermatologues et formule sans compromis.',
      },
      trust_promises: [
        { title: 'Certifie vegan', body: 'Aucun ingredient d origine animale, aucun test sur les animaux.' },
        { title: 'Packaging recycle', body: 'Tous nos emballages sont fabriques en plastique recycle ou en verre.' },
        { title: 'Made in France', body: 'Formule et produit en France, sous controle qualite strict.' },
        { title: 'Dermatologie testee', body: 'Cliniquement teste sur peaux sensibles. Resultats mesures apres 28 jours.' },
      ],
      final_cta: {
        kicker: 'Rejoignez la communaute',
        headline_html: 'Commencez votre <em>rituel</em>.',
        lede: 'Decouvrez la gamme complete et trouvez votre routine ideale.',
      },
    },
  };
}
