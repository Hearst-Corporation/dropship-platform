import type { StoreConfig } from '@/lib/store-config';
import { formatMoney, type listProducts } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { sanitizeRichText } from '@/lib/sanitize-html';
import Link from 'next/link';

type Products = Awaited<ReturnType<typeof listProducts>>['products'];

export function StorefrontBold({
  store,
  products,
}: {
  store: StoreConfig;
  products: Products;
}) {
  const heroHeadline = store.landingContent?.hero?.headline_html;
  const heroLede =
    store.landingContent?.hero?.lede ?? store.tagline ?? null;
  const trustPromises = store.landingContent?.trust_promises ?? [];
  const featuredProduct = products[0] ?? null;
  const remainingProducts = products.slice(1);

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Nav */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href={`/shop/${store.slug}`}
              className="flex items-center gap-2 font-bold text-white text-xl tracking-tight"
            >
              <StoreLogo emoji={store.logoEmoji} size={26} className="text-white" />
              <span>{store.name}</span>
            </Link>
            <Link
              href={`/shop/${store.slug}/cart`}
              className="flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white transition-colors"
              aria-label="Panier"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993
                     l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125
                     0 01-1.12-1.243l1.264-12A1.125 1.125 0
                     015.513 7.5h12.974c.576 0 1.059.435 1.119
                     1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375
                     0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375
                     0 01.75 0z"
                />
              </svg>
              <span>Panier</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Full-width hero with background image */}
      <header className="relative pt-16">
        <div
          className="relative px-6 py-40 sm:px-12 sm:py-56 lg:px-16"
          style={{ backgroundColor: store.primaryColor }}
        >
          {store.heroImageUrl && (
            <div className="absolute inset-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                src={store.heroImageUrl}
                className="size-full object-cover"
              />
            </div>
          )}
          <div aria-hidden="true" className="absolute inset-0 bg-black/50" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
            {store.landingContent?.hero?.kicker && (
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/60">
                {store.landingContent.hero.kicker}
              </p>
            )}
            {heroHeadline ? (
              <h1
                className="text-5xl font-black tracking-tight text-white sm:text-7xl"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(heroHeadline) }}
              />
            ) : (
              <h1 className="text-5xl font-black tracking-tight text-white sm:text-7xl">
                {store.name}
              </h1>
            )}
            {heroLede && (
              <p className="mt-6 text-xl text-white/80 max-w-xl">{heroLede}</p>
            )}
            <Link
              href="#products"
              className="mt-10 inline-block rounded-none border-2 border-white px-10 py-4 text-base font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors"
            >
              Decouvrir
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Trust promises bar */}
        {trustPromises.length > 0 && (
          <section
            aria-labelledby="trust-heading"
            className="border-y border-white/10 bg-zinc-900 py-10"
          >
            <h2 id="trust-heading" className="sr-only">
              Nos engagements
            </h2>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {trustPromises.map((promise, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div
                      className="h-0.5 w-6 mb-2"
                      style={{ backgroundColor: store.accentColor }}
                    />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                      {promise.title}
                    </h3>
                    <p className="text-sm text-white/50">{promise.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Products showcase */}
        <section id="products" aria-labelledby="products-heading">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <h2
              id="products-heading"
              className="text-3xl font-black uppercase tracking-tight text-white sm:text-4xl mb-12"
            >
              Collection
            </h2>

            {products.length === 0 ? (
              <p className="text-white/50">
                Aucun produit disponible pour le moment.
              </p>
            ) : (
              <>
                {/* Featured hero product */}
                {featuredProduct && (
                  <Link
                    href={`/shop/${store.slug}/products/${featuredProduct.handle}`}
                    className="group mb-12 block"
                  >
                    <div className="relative aspect-[16/7] w-full overflow-hidden bg-zinc-900">
                      {(featuredProduct.thumbnail ??
                        featuredProduct.images?.[0]?.url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={featuredProduct.title}
                          src={
                            featuredProduct.thumbnail ??
                            (featuredProduct.images?.[0]?.url as string)
                          }
                          className="size-full object-cover group-hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <StoreLogo
                            emoji={store.logoEmoji}
                            size={64}
                            className="text-white/20"
                          />
                        </div>
                      )}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
                      />
                      <div className="absolute bottom-0 left-0 p-8">
                        <h3 className="text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">
                          {featuredProduct.title}
                        </h3>
                        {(() => {
                          const v = featuredProduct.variants?.[0];
                          if (v?.calculated_price?.calculated_amount !== undefined) {
                            const p = formatMoney(
                              v.calculated_price.calculated_amount,
                              v.calculated_price.currency_code || 'eur',
                            );
                            return p ? (
                              <p
                                className="mt-2 text-xl font-bold"
                                style={{ color: store.accentColor }}
                              >
                                {p}
                              </p>
                            ) : null;
                          }
                          return null;
                        })()}
                        <span
                          className="mt-4 inline-block border border-white px-6 py-2 text-sm font-bold uppercase tracking-widest text-white group-hover:bg-white group-hover:text-black transition-colors"
                        >
                          Voir le produit
                        </span>
                      </div>
                    </div>
                  </Link>
                )}

                {/* Remaining products grid */}
                {remainingProducts.length > 0 && (
                  <div className="grid grid-cols-1 gap-px bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
                    {remainingProducts.map((product) => {
                      const imageUrl =
                        product.thumbnail ?? product.images?.[0]?.url ?? null;
                      const variant = product.variants?.[0];
                      const price =
                        variant?.calculated_price?.calculated_amount !== undefined
                          ? formatMoney(
                              variant.calculated_price.calculated_amount,
                              variant.calculated_price.currency_code || 'eur',
                            )
                          : null;

                      return (
                        <Link
                          key={product.id}
                          href={`/shop/${store.slug}/products/${product.handle}`}
                          className="group relative block bg-zinc-950 p-4 hover:bg-zinc-900 transition-colors"
                        >
                          <div className="aspect-square w-full overflow-hidden bg-zinc-900 mb-4">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt={product.title}
                                src={imageUrl}
                                className="h-full w-full object-cover group-hover:opacity-75 transition-opacity"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <StoreLogo
                                  emoji={store.logoEmoji}
                                  size={40}
                                  className="text-white/20"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                              {product.title}
                            </h3>
                            {price && (
                              <p
                                className="shrink-0 text-sm font-bold"
                                style={{ color: store.accentColor }}
                              >
                                {price}
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Final CTA */}
        {store.landingContent?.final_cta && (
          <section aria-labelledby="final-cta-heading" className="py-24">
            <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
              {store.landingContent.final_cta.kicker && (
                <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
                  {store.landingContent.final_cta.kicker}
                </p>
              )}
              {store.landingContent.final_cta.headline_html ? (
                <h2
                  id="final-cta-heading"
                  className="text-4xl font-black uppercase tracking-tight text-white sm:text-6xl"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeRichText(store.landingContent.final_cta.headline_html),
                  }}
                />
              ) : (
                <h2
                  id="final-cta-heading"
                  className="text-4xl font-black uppercase tracking-tight text-white sm:text-6xl"
                >
                  {store.name}
                </h2>
              )}
              {store.landingContent.final_cta.lede && (
                <p className="mt-6 text-lg text-white/60">
                  {store.landingContent.final_cta.lede}
                </p>
              )}
              <Link
                href="#products"
                className="mt-10 inline-block border-2 border-white px-12 py-4 text-base font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors"
              >
                Commander maintenant
              </Link>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer
        aria-labelledby="bold-footer-heading"
        className="border-t border-white/10 bg-zinc-950 py-10"
      >
        <h2 id="bold-footer-heading" className="sr-only">
          Pied de page
        </h2>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-white/80">
              <StoreLogo
                emoji={store.logoEmoji}
                size={18}
                className="text-white/60"
              />
              <span>{store.name}</span>
            </div>
            <p className="text-sm text-white/30">
              &copy; {new Date().getFullYear()} {store.name}. Tous droits
              reserves.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
