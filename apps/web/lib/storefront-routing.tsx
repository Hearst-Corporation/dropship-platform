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
 * Single source of truth for mapping a template catalog entry to the React
 * storefront component. Used by shop/[slug]/page.tsx and the admin preview.
 *
 * Mode `mono` wins over register `luxury` so `luxury-mono` renders the
 * long-form MonoProductLanding instead of StorefrontShowcase.
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
