import { DS } from '@/lib/design/css-vars';
import { resolveMonoLandingCopy } from '@/lib/design/landing-copy';
import type { StoreConfig } from '@/lib/store-config';
import { formatMoney, type listProducts } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { sanitizeRichText } from '@/lib/sanitize-html';
import Image from 'next/image';
import Link from 'next/link';

type Products = Awaited<ReturnType<typeof listProducts>>['products'];

/**
 * Premium long-form mono-product landing. Built for agent-created stores:
 * one hero SKU + generated assets (heroImageUrl, cutoutImageUrl,
 * lifestyleImages, promoVideoUrl) + structured copy (landingContent from
 * lib/agent/landing-writer.ts). Every section has a French fallback so a
 * legacy store with no landing_content still renders a complete page.
 *
 * Colors and typography come from the locked design system (`--ds-*` vars
 * injected by shop layout). luxury_copy and beach_moment are merged when present.
 *
 * Reading order is the narrative one, not the data one:
 *   hero (promesse) → produit + specs → bénéfices → récit → preuve visuelle
 *   → contenu de la boîte → prix → objections → achat.
 * Exactly one H1 (the hero), one visible H2 per section, H3 reserved for
 * sub-modules inside a section.
 */

// ── Rythme ────────────────────────────────────────────────────────────────
// Deux paliers seulement : les grands modules respirent, les sections de
// liaison (contenu, prix, objections) restent plus serrées. Uniformiser les
// paddings est ce qui donnait l'impression de blocs empilés.
const SECTION_LG = 'py-20 sm:py-28';
const SECTION_MD = 'py-16 sm:py-20';

/** Largeur de lecture confortable (~65 caractères) pour la prose. */
const PROSE = 'max-w-2xl';

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

/**
 * Libellés de structure — ils nomment le module, pas la boutique. Ils restent
 * ici plutôt que dans `landing_content` : une section sans titre dès que le LLM
 * en oublie un est exactement le défaut que cette hiérarchie corrige. Regroupés
 * pour que la voix de la page se relise d'un bloc.
 */
const SECTION_COPY = {
  specs: 'Caractéristiques',
  benefitsKicker: 'Bénéfices',
  benefitsTitle: 'Ce qui fait la différence',
  storyKicker: 'Le projet',
  galleryKicker: 'En situation',
  galleryTitle: 'Le produit dans la vraie vie',
  includedKicker: 'Contenu',
  includedTitle: 'Dans la boîte',
  pricingKicker: 'Le juste prix',
  pricingTitle: 'Pourquoi ce tarif',
  trustKicker: 'Sans risque',
  trustTitle: 'Commander en confiance',
  finalTitle: 'Passez commande, testez chez vous',
} as const;

/**
 * En-tête de section : kicker + H2 + lede optionnel. Un seul composant pour
 * toutes les sections, ce qui garantit que chaque grand module porte un titre
 * visible au même niveau typographique.
 */
function SectionHeading({
  id,
  kicker,
  title,
  titleHtml,
  lede,
  align = 'left',
}: {
  id: string;
  kicker?: string | null;
  title?: string | null;
  titleHtml?: string | null;
  lede?: string | null;
  align?: 'left' | 'center';
}) {
  const centered = align === 'center';
  return (
    <div className={centered ? `mx-auto ${PROSE} text-center` : PROSE}>
      {kicker && (
        <p
          className="mb-3 text-xs font-semibold uppercase tracking-[0.25em]"
          style={{ color: DS.accent }}
        >
          {kicker}
        </p>
      )}
      {/* Une seule balise : dupliquer le h2 pour ne changer que la source du
          contenu obligeait à répercuter chaque ajustement typo deux fois. */}
      <h2
        id={id}
        className="text-2xl font-bold tracking-tight sm:text-4xl"
        style={{ fontFamily: DS.fontDisplay, letterSpacing: DS.headingTracking }}
        {...(titleHtml
          ? { dangerouslySetInnerHTML: { __html: sanitizeRichText(titleHtml) } }
          : { children: title })}
      />
      {lede && (
        <p className="mt-4 text-lg leading-relaxed" style={{ color: DS.textMuted }}>
          {lede}
        </p>
      )}
    </div>
  );
}

export function MonoProductLanding({
  store,
  products,
}: {
  store: StoreConfig;
  products: Products;
}) {
  const copy = resolveMonoLandingCopy(store);

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

  const heroKicker = copy.heroKicker;
  const heroHeadline = copy.heroHeadline;
  const heroLede = copy.heroLede;

  const trustItems = (copy.trustPromises?.length ? copy.trustPromises : FALLBACK_TRUST).slice(0, 3);
  const sellingPoints = (copy.sellingPoints?.length ? copy.sellingPoints : FALLBACK_SELLING_POINTS).slice(0, 3);
  const specs = copy.specs ?? [];
  const includedItems = copy.includedItems ?? [];
  const lifestyleImages = store.lifestyleImages.slice(0, 3);
  const showcaseImage = store.cutoutImageUrl || productThumbnail;
  const hasGallery = lifestyleImages.length > 0 || Boolean(store.promoVideoUrl);
  const hasPricing = Boolean(copy.priceRationale || (copy.packagingHeadline && copy.packagingBody));

  // `beach_moment` n'a pas de corps : rendu seul il donnait une section vide
  // avec un titre flottant. On le réaffecte comme en-tête d'un module qui a du
  // contenu — la preuve visuelle en priorité, sinon les bénéfices.
  const beachHeadlineHtml = copy.beachMoment?.headline_html || null;
  const beachKicker = copy.beachMoment?.kicker || null;
  const beachOnGallery = hasGallery && Boolean(beachHeadlineHtml || beachKicker);

  const galleryKicker = (beachOnGallery && beachKicker) || SECTION_COPY.galleryKicker;
  const galleryHeadlineHtml = beachOnGallery ? beachHeadlineHtml : null;

  const benefitsKicker = (!beachOnGallery && beachKicker) || SECTION_COPY.benefitsKicker;
  const benefitsHeadlineHtml = beachOnGallery ? null : beachHeadlineHtml;

  const finalKicker = copy.finalCta?.kicker || 'Prêt ?';
  const finalHeadline = copy.finalCta?.headline_html;
  const finalLede =
    copy.finalNote ||
    copy.finalCta?.lede ||
    'Livraison suivie et essai de 30 jours chez vous, retour gratuit si besoin.';

  const buyLabel = price ? `Acheter · ${price}` : 'Acheter';

  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.bg, color: DS.text, fontFamily: DS.fontBody }}>
      {/* 1 ── Nav sticky fine */}
      <nav
        aria-label="Navigation principale"
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{ borderColor: DS.border, backgroundColor: 'color-mix(in srgb, var(--ds-bg) 90%, transparent)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href={`/shop/${store.slug}`} className="flex items-center gap-2">
            <StoreLogo emoji={store.logoEmoji} size={22} strokeWidth={1.5} />
            <span className="text-sm font-semibold tracking-tight">{store.name}</span>
          </Link>
          <Link
            href="/cart"
            className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ borderColor: DS.border, color: DS.text }}
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
        {/* 2 ── HERO plein écran — le seul H1 de la page */}
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
                background: `linear-gradient(140deg, ${DS.primary} 0%, ${DS.accent} 100%)`,
              }}
            />
          )}

          <div className="relative mx-auto w-full max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
            {heroKicker && (
              <p className="mb-5 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/65 sm:text-xs">
                {heroKicker}
              </p>
            )}
            <h1
              className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
              style={{ fontFamily: DS.fontDisplay, letterSpacing: DS.headingTracking }}
              {...(heroHeadline
                ? { dangerouslySetInnerHTML: { __html: sanitizeRichText(heroHeadline) } }
                : { children: store.name })}
            />
            {heroLede && (
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl">
                {heroLede}
              </p>
            )}
            {/* CTA principal en premier, prix intégré au bouton : une seule
                accroche forte au lieu d'un prix nu qui concurrence le H1. */}
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              {featured && (
                <Link
                  href={productHref}
                  className="inline-block w-full rounded-full px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 sm:w-auto"
                  style={{ backgroundColor: DS.primary }}
                >
                  {buyLabel}
                </Link>
              )}
              <Link
                href="#produit"
                className="inline-block w-full rounded-full border border-white/50 px-8 py-3.5 text-base font-medium text-white/90 transition-colors hover:bg-white/10 sm:w-auto"
              >
                Découvrir
              </Link>
            </div>
          </div>
        </header>

        {/* 3 ── LE PRODUIT : qu'est-ce que c'est, et quelles caractéristiques */}
        <section
          id="produit"
          aria-labelledby="showcase-heading"
          className={`scroll-mt-14 ${SECTION_LG}`}
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: DS.surface }}>
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
              <SectionHeading
                id="showcase-heading"
                kicker={copy.showcase?.kicker}
                titleHtml={copy.showcase?.headline_html}
                title={featured?.title || store.name}
                lede={copy.showcase?.lede}
              />

              {specs.length > 0 && (
                <div className="mt-10">
                  <h3
                    className="text-xs font-semibold uppercase tracking-[0.2em]"
                    style={{ color: DS.textMuted }}
                  >
                    {SECTION_COPY.specs}
                  </h3>
                  <dl className="mt-3">
                    {specs.map((spec, i) => (
                      <div
                        key={i}
                        className="flex items-baseline justify-between gap-6 border-t py-3.5 first:border-t-0"
                        style={{ borderColor: DS.border }}
                      >
                        <dt className="text-sm" style={{ color: DS.textMuted }}>
                          {spec.key}
                        </dt>
                        <dd className="text-right text-base font-semibold tabular-nums">
                          {spec.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {featured && (
                <Link
                  href={productHref}
                  className="mt-10 inline-block rounded-full px-8 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: DS.primary }}
                >
                  Voir la fiche produit
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* 4 ── BÉNÉFICES : pourquoi c'est mieux (titre désormais visible) */}
        <section
          aria-labelledby="selling-points-heading"
          className={`border-y ${SECTION_LG}`}
          style={{ borderColor: DS.border, backgroundColor: DS.surface }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              id="selling-points-heading"
              kicker={benefitsKicker}
              titleHtml={benefitsHeadlineHtml}
              title={SECTION_COPY.benefitsTitle}
            />
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {sellingPoints.map((point, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-6 sm:p-8"
                  style={{ borderColor: DS.border, backgroundColor: DS.bg }}
                >
                  <p
                    className="mb-4 text-xs font-semibold uppercase tracking-[0.25em]"
                    style={{ color: DS.accent }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: DS.textMuted }}>
                    {point.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5 ── RÉCIT (stores luxury uniquement) */}
        {copy.storyHeadline && (
          <section aria-labelledby="story-heading" className={SECTION_LG}>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <SectionHeading
                id="story-heading"
                kicker={SECTION_COPY.storyKicker}
                title={copy.storyHeadline}
              />
              <div className={`mt-6 ${PROSE} space-y-4`}>
                {copy.storyBody?.map((para, i) => (
                  <p key={i} className="text-lg leading-relaxed" style={{ color: DS.textMuted }}>
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 6 ── PREUVE VISUELLE — reprend le titre de beach_moment */}
        {hasGallery && (
          <section aria-labelledby="gallery-heading" className={SECTION_LG}>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <SectionHeading
                id="gallery-heading"
                kicker={galleryKicker}
                titleHtml={galleryHeadlineHtml}
                title={SECTION_COPY.galleryTitle}
              />
              {lifestyleImages.length > 0 && (
                <div
                  className={`mt-12 grid grid-cols-1 gap-4 sm:gap-6 ${
                    lifestyleImages.length === 1
                      ? ''
                      : lifestyleImages.length === 2
                        ? 'sm:grid-cols-2'
                        : 'sm:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {lifestyleImages.map((url, i) => (
                    <div key={i} className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl">
                      <Image
                        src={url}
                        alt={`${featured?.title || store.name}, vue ${i + 1}`}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
              {store.promoVideoUrl && (
                <div className="mt-6 overflow-hidden rounded-2xl">
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

        {/* 7 ── CE QUE VOUS RECEVEZ */}
        {includedItems.length > 0 && (
          <section
            aria-labelledby="included-heading"
            className={`border-y ${SECTION_MD}`}
            style={{ borderColor: DS.border, backgroundColor: DS.surface }}
          >
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
              <SectionHeading
                id="included-heading"
                kicker={SECTION_COPY.includedKicker}
                title={SECTION_COPY.includedTitle}
                align="center"
              />
              <ul className="mt-10">
                {includedItems.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-4 border-t py-3.5 first:border-t-0"
                    style={{ borderColor: DS.border }}
                  >
                    <span
                      className="w-8 shrink-0 text-sm font-semibold tabular-nums"
                      style={{ color: DS.accent }}
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

        {/* 8 ── LE PRIX (stores luxury uniquement) */}
        {hasPricing && (
          <section aria-labelledby="pricing-heading" className={SECTION_MD}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
              {/* Sans argumentaire de prix, la section porte en fait sur
                  l'emballage : on la titre par son contenu réel plutôt que de
                  laisser un titre « prix » au-dessus d'autre chose. */}
              <SectionHeading
                id="pricing-heading"
                kicker={SECTION_COPY.pricingKicker}
                title={copy.priceRationale ? SECTION_COPY.pricingTitle : copy.packagingHeadline}
                lede={copy.priceRationale ?? copy.packagingBody}
                align="center"
              />
              {copy.priceRationale && copy.packagingHeadline && copy.packagingBody && (
                <div className={`mx-auto mt-10 ${PROSE} text-center`}>
                  <h3 className="text-lg font-semibold tracking-tight">{copy.packagingHeadline}</h3>
                  <p className="mt-2 text-base leading-relaxed" style={{ color: DS.textMuted }}>
                    {copy.packagingBody}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 9 ── OBJECTIONS — les garanties arrivent au moment de décider,
                plus juste sous le hero où elles coupaient la lecture. */}
        <section
          aria-labelledby="trust-heading"
          className={`border-y ${SECTION_MD}`}
          style={{ borderColor: DS.border, backgroundColor: DS.surface }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              id="trust-heading"
              kicker={SECTION_COPY.trustKicker}
              title={SECTION_COPY.trustTitle}
            />
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {trustItems.map((item, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="mb-1 h-0.5 w-8" style={{ backgroundColor: DS.accent }} />
                  <h3 className="text-sm font-semibold uppercase tracking-wider">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: DS.textMuted }}>
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 10 ── ACHAT */}
        <section aria-labelledby="final-cta-heading" className={SECTION_LG}>
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <SectionHeading
              id="final-cta-heading"
              kicker={finalKicker}
              titleHtml={finalHeadline}
              title={SECTION_COPY.finalTitle}
              lede={finalLede}
              align="center"
            />
            <div className="mt-12 flex flex-col items-center gap-4">
              <Link
                href={productHref}
                className="inline-block w-full rounded-full px-12 py-4 text-lg font-semibold text-white shadow-sm transition-opacity hover:opacity-90 sm:w-auto"
                style={{ backgroundColor: DS.primary }}
              >
                {buyLabel}
              </Link>
              <p className="text-sm" style={{ color: DS.textMuted }}>
                Paiement sécurisé, livraison suivie
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
