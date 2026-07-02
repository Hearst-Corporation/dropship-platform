import type { StoreConfig } from '@/lib/store-config';
import { formatMoney, type listProducts } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { sanitizeRichText } from '@/lib/sanitize-html';
import Link from 'next/link';

type Products = Awaited<ReturnType<typeof listProducts>>['products'];

export function StorefrontMinimal({
  store,
  products,
}: {
  store: StoreConfig;
  products: Products;
}) {
  const currency =
    store.palette && typeof store.palette === 'object' && 'currency' in store.palette
      ? ((store.palette as { currency?: string }).currency ?? 'eur')
      : 'eur';

  const heroHeadline = store.landingContent?.hero?.headline_html;
  const heroLede = store.landingContent?.hero?.lede || store.tagline;

  const [featured, ...rest] = products;

  const featuredVariant = featured?.variants?.[0];
  const featuredPrice = featuredVariant?.calculated_price?.calculated_amount;
  const featuredImage = featured?.thumbnail || featured?.images?.[0]?.url;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href={`/shop/${store.slug}`} className="flex items-center gap-2">
            <StoreLogo emoji={store.logoEmoji} size={24} strokeWidth={1.5} className="text-gray-800" />
            <span className="text-sm font-semibold tracking-tight text-gray-900">{store.name}</span>
          </Link>
          <Link
            href="/cart"
            className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:border-gray-400 transition-colors"
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
        {products.length === 0 ? (
          <p className="py-32 text-center text-gray-500">
            Aucun produit disponible pour le moment.
          </p>
        ) : (
          <>
            {/* Hero split — premier produit en grand (adapte 03-split-with-image) */}
            {featured && (
              <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-x-12 lg:px-8 lg:py-24">
                {/* Texte produit */}
                <div className="flex flex-col justify-center lg:max-w-lg lg:self-center">
                  {store.landingContent?.hero?.kicker && (
                    <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">
                      {store.landingContent.hero.kicker}
                    </p>
                  )}
                  {heroHeadline ? (
                    <h1
                      className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(heroHeadline) }}
                    />
                  ) : (
                    <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
                      {store.name}
                    </h1>
                  )}
                  {heroLede && (
                    <p className="mt-4 text-lg text-gray-600">{heroLede}</p>
                  )}

                  {featuredPrice !== undefined && featuredPrice !== null && (
                    <p className="mt-6 text-2xl font-semibold text-gray-900">
                      {formatMoney(featuredPrice, currency)}
                    </p>
                  )}

                  <div className="mt-8 flex items-center gap-4">
                    <Link
                      href={`/shop/${store.slug}/products/${featured.handle}`}
                      className="inline-block rounded-md px-8 py-3 text-base font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: store.primaryColor }}
                    >
                      Voir le produit
                    </Link>
                  </div>

                  <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="size-5 shrink-0 text-green-500"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                      />
                    </svg>
                    Livraison rapide et retours gratuits
                  </div>
                </div>

                {/* Image produit principal */}
                <div className="mt-10 lg:col-start-2 lg:row-span-2 lg:mt-0 lg:self-center">
                  <Link
                    href={`/shop/${store.slug}/products/${featured.handle}`}
                    className="block overflow-hidden rounded-2xl"
                  >
                    {featuredImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={featuredImage}
                        alt={featured.title}
                        className="aspect-square w-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                    ) : (
                      <div
                        className="flex aspect-square w-full items-center justify-center rounded-2xl"
                        style={{ backgroundColor: store.secondaryColor || '#f4f4f5' }}
                      >
                        <StoreLogo
                          emoji={store.logoEmoji}
                          size={80}
                          strokeWidth={1}
                          className="text-gray-400"
                        />
                      </div>
                    )}
                  </Link>
                </div>
              </section>
            )}

            {/* Grille produits restants */}
            {rest.length > 0 && (
              <section className="border-t border-zinc-100 bg-zinc-50 py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  <h2 className="mb-8 text-xl font-bold text-gray-900">
                    Toute la collection
                  </h2>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {rest.map((product) => {
                      const variant = product.variants?.[0];
                      const price = variant?.calculated_price?.calculated_amount;
                      const imageUrl = product.thumbnail || product.images?.[0]?.url;
                      return (
                        <Link
                          key={product.id}
                          href={`/shop/${store.slug}/products/${product.handle}`}
                          className="group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md"
                        >
                          <div className="aspect-square overflow-hidden bg-gray-100">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt={product.title}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-gray-300">
                                <StoreLogo
                                  emoji={store.logoEmoji}
                                  size={40}
                                  strokeWidth={1.25}
                                />
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="line-clamp-2 text-sm font-medium text-gray-900">
                              {product.title}
                            </h3>
                            {price !== undefined && price !== null && (
                              <p
                                className="mt-1 text-sm font-semibold"
                                style={{ color: store.accentColor }}
                              >
                                {formatMoney(price, currency)}
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
