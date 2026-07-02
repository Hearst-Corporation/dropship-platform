import type { StoreConfig } from '@/lib/store-config';
import { formatMoney, type listProducts } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { sanitizeRichText } from '@/lib/sanitize-html';
import Link from 'next/link';

type Products = Awaited<ReturnType<typeof listProducts>>['products'];

/**
 * Premium long-form mono-product landing. Built for agent-created stores:
 * one hero SKU + generated assets (heroImageUrl, cutoutImageUrl,
 * lifestyleImages, promoVideoUrl) + structured copy (landingContent from
 * lib/agent/landing-writer.ts). Every section has a French fallback so a
 * legacy store with no landing_content still renders a complete page.
 *
 * Colors come EXCLUSIVELY from the locked design system:
 * store.palette (+ primaryColor/accentColor as legacy fallback).
 */

const FALLBACK_TRUST: Array<{ title: string; body: string }> = [
  {
    title: 'Expédition 24 h',
    body: 'Commande validée avant 16 h, votre colis part le jour même.',
  },
  {
    title: 'Retours 30 jours',
    body: 'Vous testez chez vous. Si ça ne convient pas, on reprend et on rembourse.',
  },
  {
    title: 'Paiement sécurisé',
    body: 'Transaction chiffrée, cartes et moyens de paiement usuels acceptés.',
  },
];

const FALLBACK_SELLING_POINTS: Array<{ title: string; body: string }> = [
  {
    title: 'Pensé pour durer',
    body: 'Des matériaux choisis pour un usage quotidien, sans compromis sur la finition.',
  },
  {
    title: 'Simple au quotidien',
    body: 'Prêt à l\'emploi dès la sortie de la boîte, sans réglage compliqué.',
  },
  {
    title: 'Suivi de bout en bout',
    body: 'Numéro de suivi envoyé par email dès l\'expédition, support réactif.',
  },
];

export function MonoProductLanding({
  store,
  products,
}: {
  store: StoreConfig;
  products: Products;
}) {
  // ── locked palette ──────────────────────────────────────────────────────
  const primary = store.palette?.primary ?? store.primaryColor;
  const accent = store.palette?.accent ?? store.accentColor;
  const bg = store.palette?.bg ?? '#ffffff';
  const surface = store.palette?.surface ?? '#ffffff';
  const text = store.palette?.text ?? '#18181b';
  const textMuted = store.palette?.textMuted ?? '#71717a';
  const border = store.palette?.border ?? '#e4e4e7';

  const lc = store.landingContent;

  // ── hero product ────────────────────────────────────────────────────────
  const featured = products[0] ?? null;
  const featuredVariant = featured?.variants?.[0];
  const featuredAmount = featuredVariant?.calculated_price?.calculated_amount;
  const currency = featuredVariant?.calculated_price?.currency_code || 'eur';
  const price =
    featuredAmount !== undefined && featuredAmount !== null
      ? formatMoney(featuredAmount, currency)
      : null;
  const productHref = featured
    ? `/shop/${store.slug}/products/${featured.handle}`
    : `/shop/${store.slug}`;
  const productThumbnail = featured?.thumbnail || featured?.images?.[0]?.url || null;

  // ── structured copy with FR fallbacks ───────────────────────────────────
  const heroKicker = lc?.hero?.kicker;
  const heroHeadline = lc?.hero?.headline_html;
  const heroLede = lc?.hero?.lede || store.tagline || store.description || null;

  const trustItems = (lc?.trust_promises?.length ? lc.trust_promises : FALLBACK_TRUST).slice(0, 3);
  const sellingPoints = (lc?.selling_points?.length ? lc.selling_points : FALLBACK_SELLING_POINTS).slice(0, 3);
  const specs = lc?.specs ?? [];
  const includedItems = lc?.included_items ?? [];
  const lifestyleImages = store.lifestyleImages.slice(0, 3);
  const showcaseImage = store.cutoutImageUrl || productThumbnail;

  const finalKicker = lc?.final_cta?.kicker || 'Prêt ?';
  const finalHeadline = lc?.final_cta?.headline_html;
  const finalLede =
    lc?.final_cta?.lede ||
    'Livraison suivie et essai de 30 jours chez vous, retour gratuit si besoin.';

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg, color: text }}>
      {/* 1 ── Nav sticky fine */}
      <nav
        aria-label="Navigation principale"
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{ borderColor: border, backgroundColor: `${bg}e6` }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href={`/shop/${store.slug}`} className="flex items-center gap-2">
            <StoreLogo emoji={store.logoEmoji} size={22} strokeWidth={1.5} />
            <span className="text-sm font-semibold tracking-tight">{store.name}</span>
          </Link>
          <Link
            href="/cart"
            className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ borderColor: border, color: text }}
            aria-label="Panier"
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
        {/* 2 ── HERO plein écran */}
        <header className="relative flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden">
          {store.heroImageUrl ? (
            <>
              <div className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={store.heroImageUrl}
                  alt={featured?.title || store.name}
                  className="size-full object-cover"
                />
              </div>
              <div aria-hidden="true" className="absolute inset-0 bg-black/45" />
            </>
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background: `linear-gradient(140deg, ${primary} 0%, ${accent} 100%)`,
              }}
            />
          )}

          <div className="relative mx-auto w-full max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
            {heroKicker && (
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-white/70 sm:text-sm">
                {heroKicker}
              </p>
            )}
            {heroHeadline ? (
              <h1
                className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(heroHeadline) }}
              />
            ) : (
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                {store.name}
              </h1>
            )}
            {heroLede && (
              <p className="mx-auto mt-6 max-w-xl text-lg text-white/85 sm:text-xl">{heroLede}</p>
            )}
            {price && (
              <p className="mt-6 text-2xl font-semibold text-white sm:text-3xl">{price}</p>
            )}
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="#decouvrir"
                className="inline-block w-full rounded-full border-2 border-white px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                Découvrir
              </Link>
              {featured && (
                <Link
                  href={productHref}
                  className="inline-block w-full rounded-full px-8 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
                  style={{ backgroundColor: store.heroImageUrl ? primary : 'rgba(0, 0, 0, 0.35)' }}
                >
                  Acheter
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* 3 ── Bande trust */}
        <section
          aria-labelledby="trust-heading"
          className="border-b py-10"
          style={{ borderColor: border, backgroundColor: surface }}
        >
          <h2 id="trust-heading" className="sr-only">
            Nos engagements
          </h2>
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
            {trustItems.map((item, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="mb-1 h-0.5 w-8" style={{ backgroundColor: accent }} />
                <h3 className="text-sm font-semibold uppercase tracking-wider">{item.title}</h3>
                <p className="text-sm" style={{ color: textMuted }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 4 ── SHOWCASE produit + specs */}
        <section
          id="decouvrir"
          aria-labelledby="showcase-heading"
          className="scroll-mt-14 py-16 sm:py-24"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: surface }}>
              {showcaseImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={showcaseImage}
                  alt={featured?.title || store.name}
                  className="aspect-square w-full object-contain"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center">
                  <StoreLogo
                    emoji={store.logoEmoji}
                    size={72}
                    strokeWidth={1}
                    className="opacity-30"
                  />
                </div>
              )}
            </div>

            <div>
              {lc?.showcase?.kicker && (
                <p
                  className="mb-3 text-xs font-semibold uppercase tracking-[0.25em]"
                  style={{ color: accent }}
                >
                  {lc.showcase.kicker}
                </p>
              )}
              {lc?.showcase?.headline_html ? (
                <h2
                  id="showcase-heading"
                  className="text-3xl font-bold tracking-tight sm:text-4xl"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(lc.showcase.headline_html) }}
                />
              ) : (
                <h2 id="showcase-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {featured?.title || store.name}
                </h2>
              )}
              {lc?.showcase?.lede && (
                <p className="mt-4 text-lg" style={{ color: textMuted }}>
                  {lc.showcase.lede}
                </p>
              )}

              {specs.length > 0 && (
                <dl className="mt-8 divide-y" style={{ borderColor: border }}>
                  {specs.map((spec, i) => (
                    <div
                      key={i}
                      className="flex items-baseline justify-between gap-4 border-t py-3 first:border-t-0"
                      style={{ borderColor: border }}
                    >
                      <dt
                        className="text-sm font-medium uppercase tracking-wide"
                        style={{ color: textMuted }}
                      >
                        {spec.key}
                      </dt>
                      <dd className="text-right text-sm font-semibold">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {featured && (
                <Link
                  href={productHref}
                  className="mt-8 inline-block rounded-full px-8 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primary }}
                >
                  Voir la fiche produit
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* 5 ── SELLING POINTS */}
        <section
          aria-labelledby="selling-points-heading"
          className="border-y py-16 sm:py-24"
          style={{ borderColor: border, backgroundColor: surface }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="selling-points-heading" className="sr-only">
              Pourquoi le choisir
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {sellingPoints.map((point, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-6 sm:p-8"
                  style={{ borderColor: border, backgroundColor: bg }}
                >
                  <p
                    className="mb-4 text-xs font-semibold uppercase tracking-[0.25em]"
                    style={{ color: accent }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: textMuted }}>
                    {point.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6 ── GALERIE lifestyle (+ vidéo) */}
        {(lifestyleImages.length > 0 || store.promoVideoUrl) && (
          <section aria-labelledby="gallery-heading" className="py-16 sm:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 id="gallery-heading" className="sr-only">
                Le produit en situation
              </h2>
              {lifestyleImages.length > 0 && (
                <div
                  className={`grid grid-cols-1 gap-4 sm:gap-6 ${
                    lifestyleImages.length === 1
                      ? ''
                      : lifestyleImages.length === 2
                        ? 'sm:grid-cols-2'
                        : 'sm:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {lifestyleImages.map((url, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${featured?.title || store.name}, vue ${i + 1}`}
                        className="aspect-[4/5] w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
              {store.promoVideoUrl && (
                <div
                  className={`overflow-hidden rounded-2xl ${lifestyleImages.length > 0 ? 'mt-6' : ''}`}
                >
                  <video
                    src={store.promoVideoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="aspect-video w-full object-cover"
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* 7 ── Dans la boîte */}
        {includedItems.length > 0 && (
          <section
            aria-labelledby="included-heading"
            className="border-y py-16 sm:py-20"
            style={{ borderColor: border, backgroundColor: surface }}
          >
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
              <h2
                id="included-heading"
                className="text-center text-2xl font-bold tracking-tight sm:text-3xl"
              >
                Dans la boîte
              </h2>
              <ul className="mt-8 divide-y" style={{ borderColor: border }}>
                {includedItems.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-4 border-t py-3.5 first:border-t-0"
                    style={{ borderColor: border }}
                  >
                    <span
                      className="w-8 shrink-0 text-sm font-semibold tabular-nums"
                      style={{ color: accent }}
                    >
                      {item.qty}
                    </span>
                    <span className="text-base">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* 8 ── FINAL CTA */}
        <section aria-labelledby="final-cta-heading" className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p
              className="mb-4 text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ color: accent }}
            >
              {finalKicker}
            </p>
            {finalHeadline ? (
              <h2
                id="final-cta-heading"
                className="text-3xl font-bold tracking-tight sm:text-5xl"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(finalHeadline) }}
              />
            ) : (
              <h2 id="final-cta-heading" className="text-3xl font-bold tracking-tight sm:text-5xl">
                Passez commande, testez chez vous
              </h2>
            )}
            {finalLede && (
              <p className="mt-5 text-lg" style={{ color: textMuted }}>
                {finalLede}
              </p>
            )}
            <div className="mt-10 flex flex-col items-center gap-4">
              <Link
                href={productHref}
                className="inline-block w-full rounded-full px-12 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
                style={{ backgroundColor: primary }}
              >
                {price ? `Acheter · ${price}` : 'Acheter'}
              </Link>
              <p className="text-sm" style={{ color: textMuted }}>
                Paiement sécurisé, livraison suivie
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
