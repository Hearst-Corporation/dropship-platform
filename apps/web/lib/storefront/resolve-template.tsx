import type { StoreConfig } from '@/lib/store-config';
import type { StorefrontTemplateProps } from './template-data';
import { MonoPremiumTech } from './templates/mono-premium-tech';
import { BeautyWellness } from './templates/beauty-wellness';
import { PetHomePractical } from './templates/pet-home-practical';

export type StorefrontTemplateId = 'mono-premium-tech' | 'beauty-wellness-no-claims' | 'pet-home-practical';

const REGISTRY: Record<StorefrontTemplateId, (p: StorefrontTemplateProps) => React.ReactNode> = {
  'mono-premium-tech': MonoPremiumTech,
  'beauty-wellness-no-claims': BeautyWellness,
  'pet-home-practical': PetHomePractical,
};

/**
 * Pick a REAL template from the store's template id + niche. There is no
 * "generic recolored mono" fallback: every store maps to one of the three
 * structurally-distinct factory templates. The default is the tech template.
 */
export function resolveStorefrontTemplateId(store: Pick<StoreConfig, 'template' | 'niche'>): StorefrontTemplateId {
  const s = `${store.template ?? ''} ${store.niche ?? ''}`.toLowerCase();
  if (/beaut|wellness|bien-?[ée]tre|cosm|soin|skin|spa|serum|s[ée]rum/.test(s)) {
    return 'beauty-wellness-no-claims';
  }
  if (/\bpet\b|animal|chat|chien|dog|cat|home|maison|foyer|cuisine|salon/.test(s)) {
    return 'pet-home-practical';
  }
  return 'mono-premium-tech';
}

export function getStorefrontTemplate(id: StorefrontTemplateId) {
  return REGISTRY[id];
}

/** True when the store is on a real factory template (not the generic `auto`). */
export function isRealFactoryTemplate(store: Pick<StoreConfig, 'template' | 'niche'>): boolean {
  return store.template !== 'auto' && store.template != null;
}
