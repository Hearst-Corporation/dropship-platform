import type { StoreConfig } from '@/lib/store-config';
import { formatMoney, type listProducts } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { sanitizeRichText } from '@/lib/sanitize-html';
import Link from 'next/link';

type Products = Awaited<ReturnType<typeof listProducts>>['products'];

export function StorefrontShowcase({
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
  const sellingPoints = store.landingContent?.selling_points ?? [];

  // Split products into pairs for alternating sections
  const firstProduct = products[0];
  const secondProduct = products[1];
  const remainingProducts = products.slice(2);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href={`/shop/${store.slug}`} className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: store.primaryColor }}
            >
              <StoreLogo emoji={store.logoEmoji} size={20} strokeWidth={1.5} />
            </div>
            <span className="font-semibold text-gray-900">{store.name}</span>
          </Link>
          <Link
            href={`/shop/${store.slug}/cart`}
            className="group flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: store.primaryColor }}
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
            {/* Hero avec offres (inspiré de la barre offers de 02-with-offers-and-testimonials) */}
            <div className="flex flex-col border-b border-gray-200">
              {/* Barre avantages */}
              {sellingPoints.length > 0 && (
                <div className="order-last border-t border-gray-100 lg:order-first lg:border-t-0 lg:border-b">
                  <div className="mx-auto max-w-7xl lg:px-8">
                    <ul
                      role="list"
                      className="grid grid-cols-1 divide-y divide-gray-100 lg:grid-cols-3 lg:divide-x lg:divide-y-0"
                    >
                      {sellingPoints.slice(0, 3).map((point) => (
                        <li key={point.title} className="flex flex-col">
                          <div className="flex flex-1 flex-col justify-center px-4 py-5 text-center">
                            <p className="text-sm font-semibold text-gray-900">{point.title}</p>
                            <p className="mt-1 text-sm text-gray-500">{point.body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Hero principal */}
              <div className="relative">
                <div aria-hidden="true" className="absolute inset-0 hidden h-full w-1/2 lg:block" style={{ backgroundColor: store.primaryColor + '14' }} />
                <div className="relative" style={{ backgroundColor: store.primaryColor + '14' }}>
                  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:grid lg:grid-cols-2 lg:px-8">
                    <div className="mx-auto max-w-2xl py-20 lg:max-w-none lg:py-32">
                      <div className="lg:pr-16">
                        {store.landingContent?.hero?.kicker && (
                          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
                            {store.landingContent.hero.kicker}
                          </p>
                        )}
                        {heroHeadline ? (
                          <h1
                            className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl xl:text-6xl"
                            dangerouslySetInnerHTML={{ __html: sanitizeRichText(heroHeadline) }}
                          />
                        ) : (
                          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl xl:text-6xl">
                            {store.name}
                          </h1>
                        )}
                        {heroLede && (
                          <p className="mt-4 text-xl text-gray-600">{heroLede}</p>
                        )}
                        <div className="mt-6">
                          <Link
                            href={firstProduct ? `/shop/${store.slug}/products/${firstProduct.handle}` : `#produits`}
                            className="inline-block rounded-md px-8 py-3 font-medium text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: store.primaryColor }}
                          >
                            Voir la boutique
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {firstProduct && (
                  <div className="h-48 w-full sm:h-64 lg:absolute lg:top-0 lg:right-0 lg:h-full lg:w-1/2">
                    {firstProduct.thumbnail || firstProduct.images?.[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(firstProduct.thumbnail || firstProduct.images?.[0]?.url) as string}
                        alt={firstProduct.title}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex size-full items-center justify-center"
                        style={{ backgroundColor: store.secondaryColor || '#f4f4f5' }}
                      >
                        <StoreLogo emoji={store.logoEmoji} size={80} strokeWidth={1} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section produit vedette 1 — image gauche, texte droite */}
            {firstProduct && (
              <section id="produits" className="py-16 lg:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  <div className="lg:grid lg:grid-cols-2 lg:gap-x-16 lg:items-center">
                    <div className="overflow-hidden rounded-2xl">
                      {firstProduct.thumbnail || firstProduct.images?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={(firstProduct.thumbnail || firstProduct.images?.[0]?.url) as string}
                          alt={firstProduct.title}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex aspect-square w-full items-center justify-center rounded-2xl"
                          style={{ backgroundColor: store.secondaryColor || '#f4f4f5' }}
                        >
                          <StoreLogo emoji={store.logoEmoji} size={80} strokeWidth={1} className="text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="mt-8 lg:mt-0">
                      <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                        {firstProduct.title}
                      </h2>
                      {firstProduct.description && (
                        <p className="mt-4 text-lg text-gray-600 line-clamp-4">
                          {firstProduct.description}
                        </p>
                      )}
                      {firstProduct.variants?.[0]?.calculated_price?.calculated_amount !== undefined &&
                        firstProduct.variants[0].calculated_price !== null && (
                          <p className="mt-6 text-2xl font-semibold text-gray-900">
                            {formatMoney(
                              firstProduct.variants[0].calculated_price!.calculated_amount,
                              currency,
                            )}
                          </p>
                        )}
                      <div className="mt-6">
                        <Link
                          href={`/shop/${store.slug}/products/${firstProduct.handle}`}
                          className="inline-block rounded-md border border-transparent px-8 py-3 font-medium text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: store.accentColor || store.primaryColor }}
                        >
                          Decouvrir
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Section produit vedette 2 — texte gauche, image droite */}
            {secondProduct && (
              <section className="bg-gray-50 py-16 lg:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  <div className="lg:grid lg:grid-cols-2 lg:gap-x-16 lg:items-center">
                    <div className="order-2 lg:order-1 mt-8 lg:mt-0">
                      <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                        {secondProduct.title}
                      </h2>
                      {secondProduct.description && (
                        <p className="mt-4 text-lg text-gray-600 line-clamp-4">
                          {secondProduct.description}
                        </p>
                      )}
                      {secondProduct.variants?.[0]?.calculated_price?.calculated_amount !== undefined &&
                        secondProduct.variants[0].calculated_price !== null && (
                          <p className="mt-6 text-2xl font-semibold text-gray-900">
                            {formatMoney(
                              secondProduct.variants[0].calculated_price!.calculated_amount,
                              currency,
                            )}
                          </p>
                        )}
                      <div className="mt-6">
                        <Link
                          href={`/shop/${store.slug}/products/${secondProduct.handle}`}
                          className="inline-block rounded-md border border-transparent px-8 py-3 font-medium text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: store.accentColor || store.primaryColor }}
                        >
                          Decouvrir
                        </Link>
                      </div>
                    </div>
                    <div className="order-1 lg:order-2 overflow-hidden rounded-2xl">
                      {secondProduct.thumbnail || secondProduct.images?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={(secondProduct.thumbnail || secondProduct.images?.[0]?.url) as string}
                          alt={secondProduct.title}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex aspect-square w-full items-center justify-center rounded-2xl"
                          style={{ backgroundColor: store.secondaryColor || '#f4f4f5' }}
                        >
                          <StoreLogo emoji={store.logoEmoji} size={80} strokeWidth={1} className="text-gray-300" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Grille produits restants (style trending products de 02-with-offers) */}
            {remainingProducts.length > 0 && (
              <section className="py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                      Toute la collection
                    </h2>
                  </div>
                  <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {remainingProducts.map((product) => {
                      const variant = product.variants?.[0];
                      const price = variant?.calculated_price?.calculated_amount;
                      const imageUrl = product.thumbnail || product.images?.[0]?.url;
                      return (
                        <Link
                          key={product.id}
                          href={`/shop/${store.slug}/products/${product.handle}`}
                          className="group flex flex-col text-center"
                        >
                          <div className="relative overflow-hidden rounded-xl bg-gray-100">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt={product.title}
                                className="aspect-square w-full object-cover transition-opacity duration-300 group-hover:opacity-75"
                              />
                            ) : (
                              <div className="flex aspect-square w-full items-center justify-center text-gray-300">
                                <StoreLogo
                                  emoji={store.logoEmoji}
                                  size={40}
                                  strokeWidth={1.25}
                                />
                              </div>
                            )}
                          </div>
                          <div className="mt-4">
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                              {product.title}
                            </h3>
                            {price !== undefined && price !== null && (
                              <p className="mt-1 text-sm text-gray-700">
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

            {/* Section temoignages / trust (inspiree de la section testimonials) */}
            {store.landingContent?.trust_promises && store.landingContent.trust_promises.length > 0 && (
              <section
                className="py-16"
                style={{ backgroundColor: store.primaryColor + '0d' }}
              >
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                    {store.landingContent.showcase?.headline_html
                      ? undefined
                      : 'Pourquoi nous choisir ?'}
                  </h2>
                  {store.landingContent.showcase?.headline_html && (
                    <h2
                      className="text-2xl font-bold tracking-tight text-gray-900"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichText(store.landingContent.showcase.headline_html),
                      }}
                    />
                  )}
                  <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {store.landingContent.trust_promises.map((promise) => (
                      <div key={promise.title} className="flex flex-col gap-3">
                        <div
                          className="h-1 w-8 rounded-full"
                          style={{ backgroundColor: store.accentColor || store.primaryColor }}
                        />
                        <h3 className="font-semibold text-gray-900">{promise.title}</h3>
                        <p className="text-sm text-gray-600">{promise.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        className="py-12 text-white"
        style={{ backgroundColor: store.primaryColor }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <StoreLogo
              emoji={store.logoEmoji}
              size={32}
              strokeWidth={1.25}
              className="opacity-80"
            />
            <p className="text-base font-semibold opacity-90">{store.name}</p>
            {store.tagline && (
              <p className="text-sm opacity-70">{store.tagline}</p>
            )}
            <div className="mt-4 flex gap-6 text-sm opacity-70">
              <Link href={`/shop/${store.slug}/cart`} className="hover:opacity-100 transition-opacity">
                Panier
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
