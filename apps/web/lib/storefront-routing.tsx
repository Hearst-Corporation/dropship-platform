import type { ReactElement } from 'react';
import { MonoProductLanding } from '@/app/shop/[slug]/MonoProductLanding';
import { StorefrontBold } from '@/app/shop/[slug]/StorefrontBold';
import { StorefrontEditorial } from '@/app/shop/[slug]/StorefrontEditorial';
import { StorefrontMinimal } from '@/app/shop/[slug]/StorefrontMinimal';
import { StorefrontShowcase } from '@/app/shop/[slug]/StorefrontShowcase';
import { StorefrontStreetDrop } from '@/app/shop/[slug]/StorefrontStreetDrop';
import { StorefrontAutoGarage } from '@/app/shop/[slug]/StorefrontAutoGarage';
import { StorefrontGiftCurated } from '@/app/shop/[slug]/StorefrontGiftCurated';
import type { StoreConfig } from '@/lib/store-config';
import type { TemplateCatalogEntry } from '@/lib/template-catalog';
import type { StoreProduct } from '@/lib/medusa-store';

export interface StorefrontTemplateProps {
  store: StoreConfig;
  products: StoreProduct[];
}

/** Template ids with a bespoke layout, checked before the mode/register fallback chain. */
const DEDICATED_LAYOUTS: Record<string, (props: StorefrontTemplateProps) => ReactElement> = {
  'street-drop': (props) => <StorefrontStreetDrop {...props} />,
  'auto-garage': (props) => <StorefrontAutoGarage {...props} />,
  'gift-curated': (props) => <StorefrontGiftCurated {...props} />,
};

/**
 * Maps a template catalog entry to the React storefront component.
 * Dedicated layouts (by id) win first; otherwise mode `mono` wins over
 * register `luxury` so `luxury-mono` uses MonoProductLanding.
 */
export function pickStorefrontComponent(
  entry: TemplateCatalogEntry | undefined,
  props: StorefrontTemplateProps,
): ReactElement {
  const dedicated = entry?.id ? DEDICATED_LAYOUTS[entry.id] : undefined;
  if (dedicated) return dedicated(props);

  const monoJsx =
    props.store.heroImageUrl || props.store.landingContent ? (
      <MonoProductLanding {...props} />
    ) : (
      <StorefrontMinimal {...props} />
    );

  if (entry?.mode === 'mono') return monoJsx;
  if (entry?.register === 'luxury') return <StorefrontShowcase {...props} />;
  if (entry?.mode === 'split') return <StorefrontBold {...props} />;
  return <StorefrontEditorial {...props} />;
}
