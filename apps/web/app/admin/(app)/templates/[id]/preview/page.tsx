import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { getTemplateEntry, type StoreTemplate } from '@/lib/template-catalog';
import { buildMockStore, buildMockProducts } from '@/lib/template-preview-mock';
import { AdminCard } from '@/components/admin/AdminCard';
import { MonoProductLanding } from '@/app/shop/[slug]/MonoProductLanding';
import { CollectionEditorialLanding } from '@/app/shop/[slug]/CollectionEditorialLanding';
import { LuxuryMinimalLanding } from '@/app/shop/[slug]/LuxuryMinimalLanding';
import { GenZBoldLanding } from '@/app/shop/[slug]/GenZBoldLanding';
import { EditorialFashionLanding } from '@/app/shop/[slug]/EditorialFashionLanding';
import { WellnessSoftLanding } from '@/app/shop/[slug]/WellnessSoftLanding';
import { LuxuryMonoLanding } from '@/app/shop/[slug]/LuxuryMonoLanding';
import { WellnessSerenityLanding } from '@/app/shop/[slug]/WellnessSerenityLanding';
import { WellnessPulseLanding } from '@/app/shop/[slug]/WellnessPulseLanding';
import { WellnessDanceLanding } from '@/app/shop/[slug]/WellnessDanceLanding';
import { WellnessStudioLanding } from '@/app/shop/[slug]/WellnessStudioLanding';
import { WellnessRetreatLanding } from '@/app/shop/[slug]/WellnessRetreatLanding';
import { WellnessFitnessBlogLanding } from '@/app/shop/[slug]/WellnessFitnessBlogLanding';
import { WellnessMassageQuietLanding } from '@/app/shop/[slug]/WellnessMassageQuietLanding';
import { WellnessOnyxGymLanding } from '@/app/shop/[slug]/WellnessOnyxGymLanding';
import { EventsMusicartLanding } from '@/app/shop/[slug]/EventsMusicartLanding';
import { EventsBouquetLanding } from '@/app/shop/[slug]/EventsBouquetLanding';
import { EventsArcadiumLanding } from '@/app/shop/[slug]/EventsArcadiumLanding';
import { EventsSummitLanding } from '@/app/shop/[slug]/EventsSummitLanding';
import { EventsConvergeLanding } from '@/app/shop/[slug]/EventsConvergeLanding';
import { FashionBoutique1622Landing } from '@/app/shop/[slug]/FashionBoutique1622Landing';
import { BeautySalon2851Landing } from '@/app/shop/[slug]/BeautySalon2851Landing';
import { FioraLocksLanding } from '@/app/shop/[slug]/FioraLocksLanding';
import { AdventureTravel2787Landing } from '@/app/shop/[slug]/AdventureTravel2787Landing';

export const dynamic = 'force-dynamic';

const REGISTRY: Record<string, React.ComponentType<{ store: ReturnType<typeof buildMockStore>; products: ReturnType<typeof buildMockProducts> }>> = {
  'collection-editorial': CollectionEditorialLanding,
  'luxury-minimal': LuxuryMinimalLanding,
  'gen-z-bold': GenZBoldLanding,
  'editorial-fashion': EditorialFashionLanding,
  'wellness-soft': WellnessSoftLanding,
  'luxury-mono': LuxuryMonoLanding,
  'wellness-serenity': WellnessSerenityLanding,
  'wellness-pulse': WellnessPulseLanding,
  'wellness-dance': WellnessDanceLanding,
  'wellness-studio': WellnessStudioLanding,
  'wellness-retreat': WellnessRetreatLanding,
  'wellness-fitness-blog': WellnessFitnessBlogLanding,
  'wellness-massage-quiet': WellnessMassageQuietLanding,
  'wellness-onyx-gym': WellnessOnyxGymLanding,
  'events-musicart': EventsMusicartLanding,
  'events-bouquet': EventsBouquetLanding,
  'events-arcadium': EventsArcadiumLanding,
  'events-summit': EventsSummitLanding,
  'events-converge': EventsConvergeLanding,
  'fashion-boutique-1622': FashionBoutique1622Landing,
  'beauty-salon-2851': BeautySalon2851Landing,
  'fiora-locks-wh1270': FioraLocksLanding,
  'adventure-travel-2787': AdventureTravel2787Landing,
};

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = getTemplateEntry(id);
  if (!entry) notFound();

  const store = buildMockStore(id as StoreTemplate);
  const products = buildMockProducts();

  const Comp = REGISTRY[id];

  // Fallback for templates without a dedicated Landing component
  // (mono → MonoProductLanding takes a single `product`, collection-grid
  // has no component — we render a quick notice instead).
  if (!Comp && id === 'mono') {
    return (
      <>
        <PreviewBar entry={entry} id={id} />
        <MonoProductLanding store={store} product={products[0]!} />
      </>
    );
  }
  if (!Comp) {
    return (
      <>
        <PreviewBar entry={entry} id={id} />
        <main className="flex min-h-[60vh] items-center justify-center bg-gray-900 px-6 py-16">
          <AdminCard className="max-w-lg text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              {id}
            </p>
            <h1 className="mt-2 text-xl font-semibold text-white">
              Pas de preview d&eacute;di&eacute;
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Ce template ({entry.label}) utilise le rendu par d&eacute;faut du
              storefront. Pour le voir en contexte, assigne-le &agrave; une boutique
              r&eacute;elle depuis ses r&eacute;glages.
            </p>
          </AdminCard>
        </main>
      </>
    );
  }

  return (
    <>
      <PreviewBar entry={entry} id={id} />
      <Comp store={store} products={products} />
    </>
  );
}

function PreviewBar({ entry, id }: { entry: NonNullable<ReturnType<typeof getTemplateEntry>>; id: string }) {
  return (
    <div className="sticky top-0 z-[200] border-b border-white/10 bg-gray-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-3 px-4 py-2 text-xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-bold uppercase tracking-[0.16em] text-indigo-400">Preview</span>
          <span className="text-gray-600">&middot;</span>
          <span className="truncate text-gray-300">{entry.label}</span>
          <code className="ml-2 font-mono text-[10px] text-gray-500">{id}</code>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <span className="text-[11px] text-gray-500">Donn&eacute;es fictives</span>
          <Link
            href="/admin/templates"
            className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1 font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
