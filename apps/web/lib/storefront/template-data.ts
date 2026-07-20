/**
 * Maps a loaded factory store (store + products + landing_content) into the
 * typed props each marketing block expects. Templates then pick and order the
 * blocks they want. Nothing here invents claims — it only reshapes the copy
 * the landing-writer produced; blocks with no data render nothing.
 */
import type { FactoryStore, FactoryProduct } from './factory-data';
import type { StoreConfig } from '@/lib/store-config';
import { formatPrice } from '@/components/storefront/blocks/shared';

export interface StorefrontData {
  store: StoreConfig;
  product: FactoryProduct | null;
  products: FactoryProduct[];
  ctaHref: string;
  hero: { kicker?: string; headlineHtml: string; lede?: string; imageUrl?: string | null; priceLabel?: string };
  benefits: Array<{ title: string; body: string }>;
  specs: Array<{ key: string; value: string }>;
  promises: Array<{ title: string; body: string }>;
  included: Array<{ qty: string; label: string }>;
  finalCta: { kicker?: string; headline: string; lede?: string };
  ratingLabel?: string;
  ordersLabel?: string;
  priceLabel: string;
  lifestyleImages: string[];
  heroImageUrl: string | null;
  productImageUrl: string | null;
}

export function buildStorefrontData(fs: FactoryStore): StorefrontData {
  const { store, products, hero } = fs;
  const lc = store.landingContent ?? {};
  const product = hero;
  const priceLabel = product ? formatPrice(product.priceCents) : '';

  return {
    store,
    product,
    products,
    ctaHref: '#offre',
    hero: {
      kicker: lc.hero?.kicker,
      headlineHtml: lc.hero?.headline_html || escapeHtml(store.name),
      lede: lc.hero?.lede,
      imageUrl: store.heroImageUrl || product?.imageUrl || null,
      priceLabel: priceLabel ? `dès ${priceLabel}` : undefined,
    },
    benefits: lc.selling_points ?? [],
    specs: lc.specs ?? [],
    promises: lc.trust_promises ?? [],
    included: lc.included_items ?? [],
    finalCta: {
      kicker: lc.final_cta?.kicker,
      headline: stripTags(lc.final_cta?.headline_html) || 'Prêt à commander ?',
      lede: lc.final_cta?.lede,
    },
    priceLabel,
    lifestyleImages: store.lifestyleImages ?? [],
    heroImageUrl: store.heroImageUrl || null,
    productImageUrl: product?.imageUrl || store.cutoutImageUrl || null,
  };
}

export function stripTags(html?: string): string {
  return (html ?? '').replace(/<[^>]+>/g, '').trim();
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface StorefrontTemplateProps {
  data: StorefrontData;
}

export type FactoryProductLite = FactoryProduct;
