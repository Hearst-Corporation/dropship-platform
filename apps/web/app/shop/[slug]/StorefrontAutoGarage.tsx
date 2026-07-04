import { DS, dsClass } from '@/lib/design/css-vars';
import type { StoreConfig } from '@/lib/store-config';
import { formatMoney, type listProducts } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { sanitizeRichText } from '@/lib/sanitize-html';
import { AutoGarageFitmentFilter } from '@/app/shop/[slug]/AutoGarageFitmentFilter';
import Link from 'next/link';

type Products = Awaited<ReturnType<typeof listProducts>>['products'];

const TRUST_ITEMS = [
  { label: 'Garantie 2 ans', icon: 'shield' as const },
  { label: 'Notice incluse', icon: 'doc' as const },
  { label: 'Retours 30 jours', icon: 'return' as const },
  { label: 'Livraison suivie', icon: 'truck' as const },
];

function TrustIcon({ icon }: { icon: (typeof TRUST_ITEMS)[number]['icon'] }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    className: 'size-5',
    'aria-hidden': true,
  } as const;
  switch (icon) {
    case 'shield':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286Z"
          />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
      );
    case 'return':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
          />
        </svg>
      );
    case 'truck':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25h5.25a1.125 1.125 0 0 1 1.125 1.125v4.5m-9-4.5h-5.25a1.125 1.125 0 0 0-1.125 1.125v9.375c0 .621.504 1.125 1.125 1.125H4.5"
          />
        </svg>
      );
  }
}

export function StorefrontAutoGarage({
  store,
  products,
}: {
  store: StoreConfig;
  products: Products;
}) {
  const currency = products[0]?.variants?.[0]?.calculated_price?.currency_code || 'eur';
  const heroKicker = store.landingContent?.hero?.kicker;
  const heroHeadline = store.landingContent?.hero?.headline_html;
  const heroLede = store.landingContent?.hero?.lede ?? store.tagline ?? null;
  const specs = store.landingContent?.specs ?? [];
  const trustPromises = store.landingContent?.trust_promises ?? [];

  return (
    <div
      className={`min-h-screen bg-black ${dsClass.text}`}
      style={{ fontFamily: DS.fontBody }}
    >
      {/* Nav */}
      <nav
        aria-label="Navigation principale"
        className="sticky top-0 z-20 border-b border-white/10 bg-black/95"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href={`/shop/${store.slug}`} className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center text-black"
              style={{ backgroundColor: DS.accent }}
            >
              <StoreLogo emoji={store.logoEmoji} size={18} strokeWidth={2} />
            </div>
            <span className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-white">
              {store.name}
            </span>
          </Link>
          <Link
            href="/cart"
            className="flex items-center gap-2 border border-white/20 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:border-white/50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="size-4"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
              />
            </svg>
            Panier
          </Link>
        </div>
      </nav>

      <main>
        {/* Hero — full-bleed dark, condensed uppercase title */}
        <section className="relative overflow-hidden border-b border-white/10">
          {/* Fallback dark panel when there is no hero shot yet. Falls back to
              a near-black radial gradient rather than the DS bg token: this
              template's hero is always dark regardless of the assigned
              palette's background (which may be light for other templates). */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.06), transparent 60%), #0a0a0a',
            }}
          />
          {store.heroImageUrl && (
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={store.heroImageUrl}
                alt={store.name}
                className="size-full object-cover opacity-40"
              />
            </div>
          )}
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-36">
            <div className="max-w-2xl">
              {heroKicker && (
                <p
                  className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.3em]"
                  style={{ color: DS.accent }}
                >
                  {heroKicker}
                </p>
              )}
              {heroHeadline ? (
                <h1
                  className="text-5xl font-black uppercase tracking-tight text-white sm:text-6xl xl:text-7xl"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(heroHeadline) }}
                />
              ) : (
                <h1 className="text-5xl font-black uppercase tracking-tight text-white sm:text-6xl xl:text-7xl">
                  {store.name}
                </h1>
              )}
              {heroLede && (
                <p className="mt-6 max-w-xl text-lg text-white/60">{heroLede}</p>
              )}
              <div className="mt-8">
                <Link
                  href="#produits"
                  className="inline-block px-8 py-3 font-mono text-sm font-bold uppercase tracking-widest text-black transition-opacity hover:opacity-90"
                  style={{ backgroundColor: DS.accent }}
                >
                  Voir l&apos;équipement
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Vehicle fitment selector */}
        <section className="border-b border-white/10 bg-zinc-950 py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AutoGarageFitmentFilter />
          </div>
        </section>

        {/* Product grid */}
        <section id="produits" className="py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-10 font-mono text-2xl font-bold uppercase tracking-tight text-white">
              Catalogue
            </h2>

            {products.length === 0 ? (
              <p className="py-20 text-center text-white/40">
                Aucun produit disponible pour le moment.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => {
                  const variant = product.variants?.[0];
                  const price = variant?.calculated_price?.calculated_amount;
                  const sku = variant?.sku;
                  const imageUrl = product.thumbnail || product.images?.[0]?.url;
                  return (
                    <Link
                      key={product.id}
                      href={`/shop/${store.slug}/products/${product.handle}`}
                      className="group flex flex-col bg-black p-4 transition-colors hover:bg-zinc-900"
                    >
                      <div className="relative aspect-square overflow-hidden bg-zinc-900">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt={product.title}
                            className="size-full object-cover transition-opacity duration-300 group-hover:opacity-75"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <StoreLogo
                              emoji={store.logoEmoji}
                              size={40}
                              strokeWidth={1.25}
                              className="text-white/20"
                            />
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        {sku && (
                          <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">
                            Réf. {sku}
                          </p>
                        )}
                        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                          {product.title}
                        </h3>
                        {price !== undefined && price !== null && (
                          <p
                            className="mt-2 font-mono text-sm font-bold"
                            style={{ color: DS.accent }}
                          >
                            {formatMoney(price, currency)}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Specs strip — from landingContent.specs when available */}
        {specs.length > 0 && (
          <section className="border-y border-white/10 bg-zinc-950 py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                {specs.slice(0, 4).map((spec) => (
                  <div key={spec.key} className="border-l-2 border-white/10 pl-4">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">
                      {spec.key}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Trust strip */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center border border-white/15"
                    style={{ color: DS.accent }}
                  >
                    <TrustIcon icon={item.icon} />
                  </div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-white/70">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social proof — only if the landing content has trust/testimonial copy */}
        {trustPromises.length > 0 && (
          <section className="border-t border-white/10 bg-zinc-950 py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 className="font-mono text-xl font-bold uppercase tracking-tight text-white">
                Pourquoi nous choisir
              </h2>
              <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {trustPromises.map((promise) => (
                  <div key={promise.title} className="flex flex-col gap-3">
                    <div className="h-0.5 w-8" style={{ backgroundColor: DS.accent }} />
                    <h3 className="font-mono text-sm font-bold uppercase tracking-wide text-white">
                      {promise.title}
                    </h3>
                    <p className="text-sm text-white/50">{promise.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
