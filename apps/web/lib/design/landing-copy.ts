import type { StoreConfig } from '@/lib/store-config';

/** Merges standard landing_content with luxury_copy overrides for mono layouts. */
export function resolveMonoLandingCopy(store: StoreConfig) {
  const lc = store.landingContent;
  const lux = lc?.luxury_copy;

  return {
    heroKicker: lux?.hero_eyebrow ?? lc?.hero?.kicker,
    heroHeadline: lc?.hero?.headline_html,
    heroLede: lux?.hero_lede ?? lc?.hero?.lede ?? store.tagline ?? store.description ?? null,
    storyHeadline: lux?.story_headline,
    storyBody: lux?.story_body,
    trustPromises: lc?.trust_promises,
    sellingPoints:
      lux?.atelier_pillars?.map((p) => ({ title: p.title, body: p.body })) ?? lc?.selling_points,
    priceRationale: lux?.price_rationale,
    packagingHeadline: lux?.packaging_headline,
    packagingBody: lux?.packaging_body,
    finalNote: lux?.final_cta_note,
    beachMoment: lc?.beach_moment,
    showcase: lc?.showcase,
    specs: lc?.specs,
    includedItems: lc?.included_items,
    finalCta: lc?.final_cta,
  };
}

/** Luxury register layouts read luxury_copy first, then standard hero fields. */
export function resolveLuxuryLandingCopy(store: StoreConfig) {
  const lc = store.landingContent;
  const lux = lc?.luxury_copy;

  return {
    heroKicker: lux?.hero_eyebrow ?? lc?.hero?.kicker,
    heroHeadline: lc?.hero?.headline_html,
    heroLede: lux?.hero_lede ?? lc?.hero?.lede ?? store.tagline,
    sellingPoints:
      lux?.atelier_pillars?.map((p) => ({ title: p.title, body: p.body })) ??
      lc?.selling_points ??
      lc?.trust_promises ??
      [],
    storyHeadline: lux?.story_headline,
    storyBody: lux?.story_body,
    packagingHeadline: lux?.packaging_headline,
    packagingBody: lux?.packaging_body,
    priceRationale: lux?.price_rationale,
    beachMoment: lc?.beach_moment,
  };
}
