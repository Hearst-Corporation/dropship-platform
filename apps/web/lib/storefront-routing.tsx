import type { ReactElement } from 'react';
import { MonoProductLanding } from '@/app/shop/[slug]/MonoProductLanding';
import { StorefrontBold } from '@/app/shop/[slug]/StorefrontBold';
import { StorefrontEditorial } from '@/app/shop/[slug]/StorefrontEditorial';
import { StorefrontMinimal } from '@/app/shop/[slug]/StorefrontMinimal';
import { StorefrontShowcase } from '@/app/shop/[slug]/StorefrontShowcase';
import type { StoreConfig } from '@/lib/store-config';
import type { TemplateCatalogEntry } from '@/lib/template-catalog';
import type { StoreProduct } from '@/lib/medusa-store';

export interface StorefrontTemplateProps {
  store: StoreConfig;
  products: StoreProduct[];
}

/**
 * Maps a template catalog entry to the React storefront component.
 * Mode `mono` wins over register `luxury` so `luxury-mono` uses MonoProductLanding.
 */
export function pickStorefrontComponent(
  entry: TemplateCatalogEntry | undefined,
  props: StorefrontTemplateProps,
): ReactElement {
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
