import type { StoreConfig } from '@/lib/store-config';
import { formatMoney, type listProducts } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { sanitizeRichText } from '@/lib/sanitize-html';
import Link from 'next/link';

type Products = Awaited<ReturnType<typeof listProducts>>['products'];

export function StorefrontEditorial({
  store,
  products,
}: {
  store: StoreConfig;
  products: Products;
}) {
  const heroHeadline = store.landingContent?.hero?.headline_html;
  const heroLede =
    store.landingContent?.hero?.lede ?? store.tagline ?? null;
  const sellingPoints = store.landingContent?.selling_points ?? [];

  return (
    <div className="bg-white">
      {/* Nav */}
      <nav
        aria-label="Navigation principale"
        className="bg-white/90 backdrop-blur-md border-b border-zinc-100"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href={`/shop/${store.slug}`}
              className="flex items-center gap-2 font-semibold text-zinc-900 text-lg"
            >
              <StoreLogo emoji={store.logoEmoji} size={24} className="text-zinc-700" />
              <span>{store.name}</span>
            </Link>
            <Link
              href={`/shop/${store.slug}/cart`}
              className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
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

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="pt-16 pb-20 sm:pt-24 sm:pb-32 lg:pt-40 lg:pb-48">
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="sm:max-w-lg">
              {heroHeadline ? (
                <h1
                  className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(heroHeadline) }}
                />
              ) : (
                <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">
                  {store.name}
                </h1>
              )}
              {heroLede && (
                <p className="mt-4 text-xl text-zinc-500">{heroLede}</p>
              )}
              <div className="mt-8">
                <Link
                  href={`#products`}
                  className="inline-block rounded-md px-8 py-3 text-center font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: store.primaryColor }}
                >
                  Voir la collection
                </Link>
              </div>
            </div>

            {/* Decorative image tiles grid */}
            {store.heroImageUrl || store.lifestyleImages.length > 0 ? (
              <div
                aria-hidden="true"
                className="pointer-events-none lg:absolute lg:inset-y-0 lg:mx-auto lg:w-full lg:max-w-7xl"
              >
                <div className="absolute transform sm:top-0 sm:left-1/2 sm:translate-x-8 lg:top-1/2 lg:left-1/2 lg:translate-x-8 lg:-translate-y-1/2">
                  <div className="flex items-center space-x-6 lg:space-x-8">
                    {[
                      store.heroImageUrl,
                      ...store.lifestyleImages.slice(0, 6),
                    ]
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((url, idx) => (
                        <div key={idx} className="grid shrink-0 grid-cols-1 gap-y-6 lg:gap-y-8">
                          <div className="h-64 w-44 overflow-hidden rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              alt=""
                              src={url as string}
                              className="size-full object-cover"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        {/* Selling points feature strip */}
        {sellingPoints.length > 0 && (
          <section
            aria-labelledby="selling-points-heading"
            className="bg-zinc-50 py-16 sm:py-24"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 id="selling-points-heading" className="sr-only">
                Nos atouts
              </h2>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {sellingPoints.map((point, i) => (
                  <div key={i} className="flex flex-col gap-3">
                    <div
                      className="h-1 w-8 rounded"
                      style={{ backgroundColor: store.accentColor }}
                    />
                    <h3 className="text-base font-semibold text-zinc-900">
                      {point.title}
                    </h3>
                    <p className="text-sm text-zinc-500">{point.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Products grid */}
        <section
          id="products"
          aria-labelledby="products-heading"
          className="bg-white"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="flex items-baseline justify-between">
              <h2
                id="products-heading"
                className="text-2xl font-bold tracking-tight text-zinc-900"
              >
                Notre collection
              </h2>
            </div>

            {products.length === 0 ? (
              <p className="mt-8 text-zinc-500">
                Aucun produit disponible pour le moment.
              </p>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
                {products.map((product) => {
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
                      className="group"
                    >
                      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-100">
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
                              className="text-zinc-400"
                            />
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between text-base font-medium text-zinc-900">
                        <h3>{product.title}</h3>
                        {price && <p>{price}</p>}
                      </div>
                      {product.subtitle && (
                        <p className="mt-1 text-sm text-zinc-500 italic">
                          {product.subtitle}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Brand story / showcase section */}
        {store.landingContent?.showcase && (
          <section aria-labelledby="showcase-heading">
            <div
              className="relative px-6 py-32 sm:px-12 sm:py-40 lg:px-16"
              style={{ backgroundColor: store.primaryColor }}
            >
              <div aria-hidden="true" className="absolute inset-0 bg-black/30" />
              <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
                {store.landingContent.showcase.kicker && (
                  <p className="text-sm font-semibold uppercase tracking-widest text-white/70 mb-3">
                    {store.landingContent.showcase.kicker}
                  </p>
                )}
                {store.landingContent.showcase.headline_html ? (
                  <h2
                    id="showcase-heading"
                    className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichText(store.landingContent.showcase.headline_html),
                    }}
                  />
                ) : (
                  <h2
                    id="showcase-heading"
                    className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                  >
                    {store.name}
                  </h2>
                )}
                {store.landingContent.showcase.lede && (
                  <p className="mt-3 text-xl text-white/90">
                    {store.landingContent.showcase.lede}
                  </p>
                )}
                <Link
                  href={`#products`}
                  className="mt-8 inline-block rounded-md border border-transparent bg-white px-8 py-3 text-base font-medium text-zinc-900 hover:bg-zinc-100"
                >
                  Voir les produits
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer
        aria-labelledby="footer-heading"
        className="border-t border-zinc-100 bg-white"
      >
        <h2 id="footer-heading" className="sr-only">
          Pied de page
        </h2>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <StoreLogo
                emoji={store.logoEmoji}
                size={18}
                className="text-zinc-500"
              />
              <span>{store.name}</span>
            </div>
            <p className="text-sm text-zinc-400">
              &copy; {new Date().getFullYear()} {store.name}. Tous droits
              reserves.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
