import { DS, dsClass } from '@/lib/design/css-vars';
import type { StoreConfig } from '@/lib/store-config';
import { formatMoney, type StoreProduct } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { sanitizeRichText } from '@/lib/sanitize-html';
import Link from 'next/link';
import { StreetDropCountdown } from './StreetDropCountdown';

/**
 * `street-drop` template: streetwear / urban drop-culture register. Near-black
 * canvas, single neon accent (from the store's locked palette — never
 * hardcoded here), oversized condensed uppercase type, hard edges (no
 * radius), scarcity/countdown mechanics.
 *
 * Colors and fonts flow entirely from `var(--ds-*)` (see lib/design/runtime.ts).
 * This component only supplies structure + treatment.
 */
export function StorefrontStreetDrop({
  store,
  products,
}: {
  store: StoreConfig;
  products: StoreProduct[];
}) {
  const heroHeadline = store.landingContent?.hero?.headline_html;
  const heroLede = store.landingContent?.hero?.lede ?? store.tagline ?? null;
  const heroKicker = store.landingContent?.hero?.kicker;

  // No dedicated "drop date" column exists on dropship_stores yet. Repurpose
  // publishedAt + a fixed 72h window as an OPTIONAL countdown target rather
  // than inventing a new required field in this pass — if the store has no
  // publishedAt, the countdown section renders as a generic badge instead.
  // Liveness (target still in the future) is decided client-side by
  // <StreetDropCountdown>, which renders nothing once elapsed — this keeps
  // `Date.now()` out of the server component's render body.
  const dropTargetIso = store.publishedAt
    ? new Date(new Date(store.publishedAt).getTime() + 72 * 60 * 60 * 1000).toISOString()
    : null;

  const testimonials = store.landingContent?.selling_points ?? [];

  return (
    <div className={`min-h-screen ${dsClass.bg} ${dsClass.text}`} style={{ fontFamily: DS.fontBody }}>
      {/* Nav */}
      <nav
        aria-label="Navigation principale"
        className={`fixed inset-x-0 top-0 z-30 border-b ${dsClass.border}`}
        style={{ backgroundColor: 'color-mix(in srgb, var(--ds-bg) 92%, transparent)' }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href={`/shop/${store.slug}`}
              className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-white"
            >
              <StoreLogo emoji={store.logoEmoji} size={26} className="text-white" />
              <span>{store.name}</span>
            </Link>
            <Link
              href="/cart"
              className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-white/70 transition-colors hover:text-white"
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

      {/* Drop announcement banner */}
      <div
        className="pt-16 text-center"
        style={{ backgroundColor: DS.accent }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-black sm:text-sm">
          <span>Drop — {store.name}</span>
          <span aria-hidden="true">·</span>
          <StreetDropCountdown targetIso={dropTargetIso} fallback="Nouvelle collection" />
        </div>
      </div>

      {/* Hero */}
      <header className="relative">
        <div className="relative overflow-hidden px-6 py-32 sm:px-12 sm:py-48 lg:px-16">
          {store.heroImageUrl ? (
            <div className="absolute inset-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={store.name}
                src={store.heroImageUrl}
                className="size-full object-cover grayscale-[15%]"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-black/70" />
            </div>
          ) : (
            <div className="absolute inset-0" style={{ backgroundColor: DS.bg }} />
          )}
          {/* Faint grunge texture overlay */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.08] mix-blend-screen"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)',
            }}
          />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
            {heroKicker && (
              <p
                className="mb-5 text-xs font-black uppercase tracking-[0.35em]"
                style={{ color: DS.accent }}
              >
                {heroKicker}
              </p>
            )}
            {heroHeadline ? (
              <h1
                className="text-6xl leading-[0.9] font-black uppercase tracking-tighter text-white sm:text-8xl"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(heroHeadline) }}
              />
            ) : (
              <h1 className="text-6xl leading-[0.9] font-black uppercase tracking-tighter text-white sm:text-8xl">
                {store.name}
              </h1>
            )}
            {heroLede && (
              <p className="mt-6 max-w-xl text-lg font-medium text-white/70">{heroLede}</p>
            )}
            <Link
              href="#drop"
              className="mt-10 inline-block px-10 py-4 text-sm font-black uppercase tracking-[0.2em] text-black transition-opacity hover:opacity-85"
              style={{ backgroundColor: DS.accent }}
            >
              Voir le drop
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Scarcity stat strip */}
        <section aria-labelledby="stats-heading" className={`border-y ${dsClass.border} bg-black`}>
          <h2 id="stats-heading" className="sr-only">
            Chiffres clés
          </h2>
          <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              { value: String(products.length).padStart(2, '0'), label: 'Pièces disponibles' },
              { value: '24H', label: 'Livraison rapide' },
              { value: '100%', label: 'Édition limitée' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                <span
                  className="text-5xl font-black tracking-tighter sm:text-6xl"
                  style={{ color: DS.accent, fontFamily: DS.fontDisplay }}
                >
                  {stat.value}
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Product grid */}
        <section id="drop" aria-labelledby="drop-heading">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <h2
              id="drop-heading"
              className="mb-12 text-4xl font-black uppercase tracking-tighter text-white sm:text-5xl"
            >
              La collection
            </h2>

            {products.length === 0 ? (
              <p className="text-white/50">Aucun produit disponible pour le moment.</p>
            ) : (
              <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
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

                  return (
                    <Link
                      key={product.id}
                      href={`/shop/${store.slug}/products/${product.handle}`}
                      className="group relative block aspect-[4/5] overflow-hidden bg-black"
                    >
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={product.title}
                          src={imageUrl}
                          className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                          <StoreLogo emoji={store.logoEmoji} size={48} className="text-white/20" />
                        </div>
                      )}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-90 transition-opacity group-hover:opacity-100"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-5">
                        <h3 className="text-base font-black uppercase tracking-tight text-white sm:text-lg">
                          {product.title}
                        </h3>
                        {price && (
                          <p
                            className="shrink-0 font-mono text-sm font-bold"
                            style={{ color: DS.accent }}
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
          </div>
        </section>

        {/* Social proof */}
        {testimonials.length > 0 && (
          <section aria-labelledby="proof-heading" className={`border-t ${dsClass.border} bg-black py-20`}>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2
                id="proof-heading"
                className="mb-10 text-center text-xs font-black uppercase tracking-[0.3em] text-white/40"
              >
                Ce qu&apos;ils en disent
              </h2>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
                {testimonials.slice(0, 3).map((item, i) => (
                  <blockquote key={i} className="flex flex-col gap-3">
                    <div className="h-0.5 w-8" style={{ backgroundColor: DS.accent }} />
                    <p className="text-sm font-bold uppercase tracking-wide text-white">{item.title}</p>
                    <p className="text-sm text-white/50">{item.body}</p>
                  </blockquote>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Final CTA */}
        {store.landingContent?.final_cta && (
          <section aria-labelledby="final-cta-heading" className="py-24">
            <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
              {store.landingContent.final_cta.kicker && (
                <p
                  className="mb-4 text-xs font-black uppercase tracking-[0.3em]"
                  style={{ color: DS.accent }}
                >
                  {store.landingContent.final_cta.kicker}
                </p>
              )}
              {store.landingContent.final_cta.headline_html ? (
                <h2
                  id="final-cta-heading"
                  className="text-4xl font-black uppercase tracking-tighter text-white sm:text-6xl"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeRichText(store.landingContent.final_cta.headline_html),
                  }}
                />
              ) : (
                <h2
                  id="final-cta-heading"
                  className="text-4xl font-black uppercase tracking-tighter text-white sm:text-6xl"
                >
                  {store.name}
                </h2>
              )}
              {store.landingContent.final_cta.lede && (
                <p className="mt-6 text-lg text-white/60">{store.landingContent.final_cta.lede}</p>
              )}
              <Link
                href="#drop"
                className="mt-10 inline-block px-12 py-4 text-sm font-black uppercase tracking-[0.2em] text-black transition-opacity hover:opacity-85"
                style={{ backgroundColor: DS.accent }}
              >
                Commander maintenant
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
