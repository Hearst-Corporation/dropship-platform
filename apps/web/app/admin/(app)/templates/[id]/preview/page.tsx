import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TEMPLATE_CATALOG } from '@/lib/template-catalog';
import { pickStorefrontComponent } from '@/lib/storefront-routing';
import { buildMockStore, MOCK_PRODUCTS } from './_mock';

export const dynamic = 'force-dynamic';

/**
 * Template preview — renders the real Storefront component for the given
 * template id, using mock store config + mock products. No DB, no network.
 *
 * Component mapping (mirrors shop/[slug]/page.tsx logic):
 *   register === 'luxury'  => StorefrontShowcase
 *   mode === 'mono'        => StorefrontMinimal
 *   mode === 'split'       => StorefrontBold
 *   default                => StorefrontEditorial
 */
export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 'auto' is a meta-value (resolved at render time from store mode/count).
  // It has no fixed layout to preview, so treat it like an unknown id.
  if (id === 'auto') notFound();

  const entry = TEMPLATE_CATALOG.find((t) => t.id === id);
  if (!entry) notFound();

  const store = buildMockStore(id, entry.label);
  const products = MOCK_PRODUCTS;

  const storefrontJsx = pickStorefrontComponent(entry, { store, products });

  return (
    <div>
      {/* Admin header bar */}
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 py-2.5 backdrop-blur-sm text-sm">
        <Link
          href="/admin/templates"
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
          Templates
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="font-semibold text-zinc-900">{entry.label}</span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-500">
          {id}
        </span>
        <span className="ml-auto rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Apercu avec donnees fictives
        </span>
      </div>

      {/* Full-bleed storefront render */}
      {storefrontJsx}
    </div>
  );
}
