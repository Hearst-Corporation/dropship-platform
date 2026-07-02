import Link from 'next/link';
import type { StoreConfig } from '@/lib/store-config';
import type { StoreProduct } from '@/lib/medusa-store';
import { formatMoney } from '@/lib/medusa-store';
import { sanitizeRichText } from '@/lib/sanitize-html';
import { DS } from '@/lib/design/css-vars';

interface SmartHeroProps {
  store: StoreConfig;
  product?: StoreProduct | null;
  ctaHref?: string;
  ctaLabel?: string;
}

export function SmartHero({ store, product, ctaHref, ctaLabel }: SmartHeroProps) {
  const landing = store.landingContent;
  const kicker = landing?.hero?.kicker;
  const headline = landing?.hero?.headline_html;
  const lede = landing?.hero?.lede ?? store.tagline;
  const variant = product?.variants?.[0];
  const price = variant?.calculated_price?.calculated_amount;
  const currency = variant?.calculated_price?.currency_code || 'eur';
  const href = ctaHref ?? (product ? `/shop/${store.slug}/products/${product.handle}` : `/shop/${store.slug}`);
  const label = ctaLabel ?? (product ? 'Acheter' : 'Découvrir');

  return (
    <header className="relative flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden">
      {store.heroImageUrl ? (
        <>
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={store.heroImageUrl} alt={store.name} className="size-full object-cover" />
          </div>
          <div aria-hidden="true" className="absolute inset-0 bg-black/45" />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: `linear-gradient(140deg, ${DS.primary} 0%, ${DS.accent} 100%)` }}
        />
      )}

      <div className="relative mx-auto w-full max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
        {kicker && (
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-white/70 sm:text-sm">
            {kicker}
          </p>
        )}
        {headline ? (
          <h1
            className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(headline) }}
          />
        ) : (
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">{store.name}</h1>
        )}
        {lede && <p className="mx-auto mt-6 max-w-xl text-lg text-white/85 sm:text-xl">{lede}</p>}
        {price !== undefined && (
          <p className="mt-6 text-2xl font-semibold text-white sm:text-3xl">{formatMoney(price, currency)}</p>
        )}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href={href}
            className="inline-block w-full rounded-full px-8 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
            style={{ backgroundColor: store.heroImageUrl ? DS.primary : 'rgba(0, 0, 0, 0.35)' }}
          >
            {label}
          </Link>
        </div>
      </div>
    </header>
  );
}
