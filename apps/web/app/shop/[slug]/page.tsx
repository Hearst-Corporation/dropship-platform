import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getStoreBySlug } from '@/lib/store-config';
import { formatMoney, listProducts } from '@/lib/medusa-store';
import { breadcrumbList, organizationSchema, storeUrl, withCanonical } from '@/lib/seo';
import { TrackPageView } from '@/components/analytics/TrackPageView';
import { StoreLogo } from '@/components/ui';
import { TEMPLATE_CATALOG, type StoreTemplate } from '@/lib/template-catalog';
import { StorefrontEditorial } from './StorefrontEditorial';
import { StorefrontBold } from './StorefrontBold';
import { StorefrontMinimal } from './StorefrontMinimal';
import { StorefrontShowcase } from './StorefrontShowcase';

export const dynamic = 'force-dynamic';


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  const description =
    store.description ||
    `Découvrez ${store.productCount} produit${store.productCount > 1 ? 's' : ''} ${store.niche} soigneusement sélectionnés.`;
  const ogImage = store.heroImageUrl || store.cutoutImageUrl || undefined;
  return withCanonical(
    {
      title: `${store.name} — ${store.tagline || store.niche}`,
      description,
      openGraph: {
        title: store.name,
        description: store.tagline || description,
        type: 'website',
        url: storeUrl(slug),
        siteName: store.name,
        images: ogImage ? [{ url: ogImage }] : [],
      },
      twitter: {
        card: ogImage ? 'summary_large_image' : 'summary',
        title: store.name,
        description: store.tagline || description,
        images: ogImage ? [ogImage] : undefined,
      },
    },
    `/shop/${slug}`,
  );
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  // Splash only while asset generation is genuinely in flight.
  const assetsReady = store.assetsStatus === 'ready' || store.heroImageUrl;
  const assetsInFlight =
    store.assetsStatus === 'pending' || store.assetsStatus === 'generating';
  const isMonoWithoutAssets = store.mode === 'mono' && !assetsReady && assetsInFlight;
  if (isMonoWithoutAssets) {
    return <StorePreparing store={store} />;
  }

  let products: Awaited<ReturnType<typeof listProducts>>['products'] = [];
  let error: string | null = null;

  try {
    const result = await listProducts({ limit: 50, publishableKey: store.medusaPublishableKey });
    products = result.products;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur chargement produits';
  }

  const orgJsonLd = JSON.stringify(organizationSchema(store));
  const breadcrumbJsonLd = JSON.stringify(
    breadcrumbList([{ name: store.name, url: storeUrl(slug) }]),
  );

  // Storefront error tone — read from the locked palette when available.
  const paletteDanger =
    (store.palette && typeof store.palette === 'object' && 'danger' in store.palette
      ? (store.palette as { danger?: string }).danger
      : undefined) ?? null;
  const errorTone = paletteDanger
    ? { bg: 'transparent', text: paletteDanger, border: paletteDanger }
    : { bg: '#fafafa', text: '#3f3f46', border: '#e4e4e7' };

  // The 24 bespoke landing templates were removed (audit cleanup). Every store
  // now renders the generic storefront: hero + product grid, driven by the
  // store's locked palette. The single/grid distinction is kept for UX.
  const isMono = products.length === 1;

  // Template selector — maps store.template to a bespoke storefront when available.
  if (store.template && store.template !== 'auto' && products.length > 0 && !error) {
    const entry = TEMPLATE_CATALOG.find((t) => t.id === (store.template as StoreTemplate));
    const templateProps = { store, products };
    const storefrontJsx =
      entry?.register === 'luxury' ? <StorefrontShowcase {...templateProps} /> :
      entry?.mode === 'mono'       ? <StorefrontMinimal {...templateProps} /> :
      entry?.mode === 'split'      ? <StorefrontBold {...templateProps} /> :
      <StorefrontEditorial {...templateProps} />;

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
        <TrackPageView
          slug={slug}
          eventName={isMono && products[0] ? 'view_content' : 'page_view'}
          productId={isMono ? products[0]?.id : undefined}
          variantId={isMono ? products[0]?.variants?.[0]?.id : undefined}
        />
        {storefrontJsx}
      </>
    );
  }

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <TrackPageView
        slug={slug}
        eventName={isMono && products[0] ? 'view_content' : 'page_view'}
        productId={isMono ? products[0]?.id : undefined}
        variantId={isMono ? products[0]?.variants?.[0]?.id : undefined}
      />

      {/* Hero */}
      <section
        className="py-20 text-center text-white"
        style={{ backgroundColor: store.primaryColor }}
      >
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-5 inline-flex"><StoreLogo emoji={store.logoEmoji} size={56} strokeWidth={1.25} /></div>
          <h1 className="mb-3 text-4xl font-bold">{store.name}</h1>
          {store.tagline && <p className="mb-2 text-xl opacity-90">{store.tagline}</p>}
          {store.description && (
            <p className="mx-auto max-w-lg text-sm opacity-70">{store.description}</p>
          )}
          <div
            className="mt-6 inline-block rounded-full px-6 py-2 text-sm font-medium"
            style={{ backgroundColor: store.accentColor }}
          >
            {store.productCount} produits disponibles
          </div>
        </div>
      </section>

      {/* Products grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-zinc-900">Nos produits</h2>

        {error && (
          <div
            className="mb-6 rounded-sm border p-4"
            style={{ backgroundColor: errorTone.bg, color: errorTone.text, borderColor: errorTone.border }}
          >
            {error}
          </div>
        )}

        {!error && products.length === 0 && (
          <p className="py-20 text-center text-zinc-500">Aucun produit disponible pour le moment.</p>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const variant = product.variants?.[0];
            const price = variant?.calculated_price?.calculated_amount;
            const imageUrl = product.thumbnail || product.images?.[0]?.url;

            return (
              <Link
                key={product.id}
                href={`/shop/${slug}/products/${product.handle}`}
                className="group overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="aspect-square overflow-hidden bg-zinc-100">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                      <StoreLogo emoji={store.logoEmoji} size={40} strokeWidth={1.25} />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-zinc-900">
                    {product.title}
                  </h3>
                  {price !== undefined && (
                    <div className="text-lg font-bold" style={{ color: store.accentColor }}>
                      {formatMoney(price, variant?.calculated_price?.currency_code || 'eur')}
                    </div>
                  )}
                  <div
                    className="mt-3 w-full rounded-lg py-2 text-center text-sm font-medium text-white transition-opacity group-hover:opacity-90"
                    style={{ backgroundColor: store.primaryColor }}
                  >
                    Voir le produit
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StorePreparing({ store }: { store: import('@/lib/store-config').StoreConfig }) {
  const accent =
    store.palette && typeof store.palette === 'object' && 'accent' in store.palette
      ? (store.palette as { accent?: string }).accent ?? null
      : null;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-white">
      <div className="max-w-md space-y-6 text-center">
        <div className="text-5xl">{store.logoEmoji || '🛍️'}</div>
        <h2 className="text-3xl font-bold tracking-tight">{store.name}</h2>
        <p className="text-lg text-zinc-400">
          Votre boutique est en cours de préparation. Revenez dans quelques minutes.
        </p>
        <div className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <span
            className={`h-1.5 w-1.5 animate-pulse rounded-full${accent ? '' : ' bg-zinc-400'}`}
            style={accent ? { backgroundColor: accent } : undefined}
          />
          Génération des visuels en cours…
        </div>
      </div>
    </main>
  );
}
