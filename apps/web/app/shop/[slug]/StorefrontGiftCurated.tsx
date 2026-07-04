import { DS, dsClass } from '@/lib/design/css-vars';
import type { StoreConfig } from '@/lib/store-config';
import { formatMoney, type listProducts } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { sanitizeRichText } from '@/lib/sanitize-html';
import Link from 'next/link';

type Products = Awaited<ReturnType<typeof listProducts>>['products'];

// Presentational only — these chips are not wired to real occasion/recipient
// tags on products. There is no occasion taxonomy in the data model yet
// (checked lib/agent/store-schema.ts and lib/store-config.ts: LandingContent
// has no occasion/recipient field). Wiring this to real filtering is a future
// enhancement that would require a product metadata field (e.g. a Medusa
// product tag or a dedicated `occasion` column) plus filtering logic here.
const OCCASION_CHIPS = ['Pour elle', 'Pour lui', 'Anniversaire', 'Fêtes', 'Merci', 'Naissance'];

/**
 * Storefront layout for the `gift-curated` template — curated gift sets/boxes.
 * The product IS a bundle: occasion-driven navigation (presentational for
 * now), unboxing/presentation emphasis, warm inviting palette read entirely
 * from the locked design system (var(--ds-*) tokens via DS / dsClass).
 *
 * `landingContent.included_items` (IncludedItemSchema: { qty, label }) is the
 * real "what's in the box" data model when a store has it — see
 * lib/agent/store-schema.ts. When absent, the "what's inside" accordion falls
 * back to rendering the product's existing Medusa description elegantly,
 * without inventing fake bundle contents.
 */
export function StorefrontGiftCurated({
  store,
  products,
}: {
  store: StoreConfig;
  products: Products;
}) {
  const heroHeadline = store.landingContent?.hero?.headline_html;
  const heroKicker = store.landingContent?.hero?.kicker;
  const heroLede = store.landingContent?.hero?.lede ?? store.tagline ?? null;
  const includedItems = store.landingContent?.included_items ?? [];
  const heroProduct = products[0];

  return (
    <div className={`min-h-screen ${dsClass.bg} ${dsClass.text}`} style={{ fontFamily: DS.fontBody }}>
      {/* Nav */}
      <nav
        aria-label="Navigation principale"
        className={`backdrop-blur-md border-b ${dsClass.border} ${dsClass.surface}/90`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href={`/shop/${store.slug}`}
              className={`flex items-center gap-2 font-semibold text-lg ${dsClass.text}`}
            >
              <StoreLogo emoji={store.logoEmoji} size={24} className="text-zinc-700" />
              <span>{store.name}</span>
            </Link>
            <Link
              href={`/shop/${store.slug}/cart`}
              className={`flex items-center gap-1.5 text-sm ${dsClass.textMuted} hover:opacity-80 transition-colors`}
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

      {/* Hero — warm full-bleed image, ribbon-motif accent via CSS only */}
      <header className="relative overflow-hidden">
        {store.heroImageUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              aria-hidden="true"
              src={store.heroImageUrl}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:px-6 sm:py-40 lg:px-8">
              {heroKicker && (
                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
                  {heroKicker}
                </p>
              )}
              {heroHeadline ? (
                <h1
                  className="text-4xl font-bold tracking-tight text-white sm:text-6xl"
                  style={{ fontFamily: DS.fontDisplay, letterSpacing: DS.headingTracking }}
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(heroHeadline) }}
                />
              ) : (
                <h1
                  className="text-4xl font-bold tracking-tight text-white sm:text-6xl"
                  style={{ fontFamily: DS.fontDisplay, letterSpacing: DS.headingTracking }}
                >
                  {store.name}
                </h1>
              )}
              {heroLede && <p className="mx-auto mt-5 max-w-xl text-lg text-white/90">{heroLede}</p>}
              <div className="mt-10">
                <Link
                  href="#gift-sets"
                  className="inline-block rounded-full px-8 py-3 text-center font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: DS.primary }}
                >
                  Découvrir les coffrets
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="relative border-b"
            style={{ backgroundColor: DS.bg, borderColor: DS.border }}
          >
            <div className="mx-auto max-w-4xl px-4 py-28 text-center sm:px-6 sm:py-40 lg:px-8">
              {heroKicker && (
                <p
                  className="mb-4 text-sm font-semibold uppercase tracking-[0.2em]"
                  style={{ color: DS.accent }}
                >
                  {heroKicker}
                </p>
              )}
              {heroHeadline ? (
                <h1
                  className="text-4xl font-bold tracking-tight sm:text-6xl"
                  style={{ fontFamily: DS.fontDisplay, letterSpacing: DS.headingTracking, color: DS.text }}
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(heroHeadline) }}
                />
              ) : (
                <h1
                  className="text-4xl font-bold tracking-tight sm:text-6xl"
                  style={{ fontFamily: DS.fontDisplay, letterSpacing: DS.headingTracking, color: DS.text }}
                >
                  {store.name}
                </h1>
              )}
              {heroLede && (
                <p className={`mx-auto mt-5 max-w-xl text-lg ${dsClass.textMuted}`}>{heroLede}</p>
              )}
              <div className="mt-10">
                <Link
                  href="#gift-sets"
                  className="inline-block rounded-full px-8 py-3 text-center font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: DS.primary }}
                >
                  Découvrir les coffrets
                </Link>
              </div>
            </div>
            {/* Ribbon-motif accent, CSS only */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5"
              style={{
                background: `linear-gradient(90deg, ${DS.primary}, ${DS.accent}, ${DS.primary})`,
              }}
            />
          </div>
        )}
      </header>

      <main>
        {/* Shop by occasion — presentational chip row, see OCCASION_CHIPS comment above */}
        <section aria-labelledby="occasions-heading" className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2
              id="occasions-heading"
              className={`text-center text-sm font-semibold uppercase tracking-[0.2em] ${dsClass.textMuted}`}
            >
              Un coffret pour chaque occasion
            </h2>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {OCCASION_CHIPS.map((label) => (
                <li key={label}>
                  <span
                    className={`inline-flex items-center rounded-full border px-5 py-2 text-sm font-medium ${dsClass.border} ${dsClass.text}`}
                    style={{ backgroundColor: DS.surface }}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Gift set showcase */}
        <section
          id="gift-sets"
          aria-labelledby="gift-sets-heading"
          className="py-16 sm:py-24"
          style={{ backgroundColor: DS.surface }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="gift-sets-heading"
                className="text-3xl font-bold tracking-tight sm:text-4xl"
                style={{ fontFamily: DS.fontDisplay, color: DS.text }}
              >
                Nos coffrets
              </h2>
              <p className={`mt-3 text-base ${dsClass.textMuted}`}>
                Composés avec soin, prêts à offrir.
              </p>
            </div>

            {products.length === 0 ? (
              <p className={`mt-8 text-center ${dsClass.textMuted}`}>
                Aucun coffret disponible pour le moment.
              </p>
            ) : (
              <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => {
                  const imageUrl = product.thumbnail ?? product.images?.[0]?.url ?? null;
                  const variant = product.variants?.[0];
                  const price =
                    variant?.calculated_price?.calculated_amount !== undefined
                      ? formatMoney(
                          variant.calculated_price.calculated_amount,
                          variant.calculated_price.currency_code || 'eur',
                        )
                      : null;
                  const excerpt = product.description
                    ? product.description.length > 140
                      ? `${product.description.slice(0, 140).trim()}…`
                      : product.description
                    : null;

                  return (
                    <Link
                      key={product.id}
                      href={`/shop/${store.slug}/products/${product.handle}`}
                      className="group flex flex-col"
                    >
                      <div
                        className="aspect-[4/5] w-full overflow-hidden rounded-2xl"
                        style={{ backgroundColor: DS.bg }}
                      >
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={product.title}
                            src={imageUrl}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <StoreLogo emoji={store.logoEmoji} size={40} className={dsClass.textMuted} />
                          </div>
                        )}
                      </div>
                      <div className="mt-5 flex items-start justify-between gap-4">
                        <h3
                          className="text-lg font-semibold"
                          style={{ fontFamily: DS.fontDisplay, color: DS.text }}
                        >
                          {product.title}
                        </h3>
                        {price && (
                          <p className="shrink-0 text-lg font-semibold" style={{ color: DS.accent }}>
                            {price}
                          </p>
                        )}
                      </div>
                      {excerpt && (
                        <p className={`mt-2 text-sm leading-relaxed ${dsClass.textMuted}`}>{excerpt}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* "What's inside" — the hero/first product's full contents, presented
            elegantly. Uses landingContent.included_items (real structured
            bundle-contents data, IncludedItemSchema: { qty, label }) when the
            store has it; otherwise falls back to the product's own Medusa
            description text, framed the same way. */}
        {heroProduct && (
          <section aria-labelledby="whats-inside-heading" className="py-16 sm:py-24">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
              <h2
                id="whats-inside-heading"
                className="text-center text-3xl font-bold tracking-tight sm:text-4xl"
                style={{ fontFamily: DS.fontDisplay, color: DS.text }}
              >
                Ce que contient ce coffret
              </h2>

              <details
                className={`mt-10 rounded-2xl border p-6 sm:p-8 ${dsClass.border}`}
                style={{ backgroundColor: DS.surface }}
                open
              >
                <summary
                  className="cursor-pointer text-lg font-semibold"
                  style={{ color: DS.text }}
                >
                  {heroProduct.title}
                </summary>

                {includedItems.length > 0 ? (
                  <ul className="mt-6 space-y-4 border-t pt-6" style={{ borderColor: DS.border }}>
                    {includedItems.map((item, i) => (
                      <li key={i} className="flex items-baseline gap-4">
                        <span
                          className="shrink-0 text-sm font-semibold tabular-nums"
                          style={{ color: DS.accent }}
                        >
                          {item.qty}
                        </span>
                        <span className={`text-base ${dsClass.text}`}>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : heroProduct.description ? (
                  <p
                    className={`mt-6 border-t pt-6 text-base leading-loose whitespace-pre-line ${dsClass.textMuted}`}
                    style={{ borderColor: DS.border }}
                  >
                    {heroProduct.description}
                  </p>
                ) : (
                  <p className={`mt-6 border-t pt-6 text-base ${dsClass.textMuted}`} style={{ borderColor: DS.border }}>
                    Le détail de ce coffret sera bientôt disponible.
                  </p>
                )}
              </details>
            </div>
          </section>
        )}

        {/* Brand story / showcase — reuse landingContent.showcase like the
            other editorial-leaning layouts, omitted gracefully when absent. */}
        {store.landingContent?.showcase && (
          <section aria-labelledby="showcase-heading">
            <div
              className="relative px-6 py-32 sm:px-12 sm:py-40 lg:px-16"
              style={{ backgroundColor: DS.primary }}
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
                    style={{ fontFamily: DS.fontDisplay }}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichText(store.landingContent.showcase.headline_html),
                    }}
                  />
                ) : (
                  <h2
                    id="showcase-heading"
                    className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    style={{ fontFamily: DS.fontDisplay }}
                  >
                    {store.name}
                  </h2>
                )}
                {store.landingContent.showcase.lede && (
                  <p className="mt-3 text-xl text-white/90">{store.landingContent.showcase.lede}</p>
                )}
                <Link
                  href="#gift-sets"
                  className="mt-8 inline-block rounded-full border border-transparent bg-white px-8 py-3 text-base font-medium text-zinc-900 hover:bg-zinc-100"
                >
                  Voir les coffrets
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
