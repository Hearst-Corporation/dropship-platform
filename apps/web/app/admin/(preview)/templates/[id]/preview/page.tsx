import { notFound } from 'next/navigation';
import { TEMPLATE_CATALOG } from '@/lib/template-catalog';
import { pickStorefrontComponent } from '@/lib/storefront-routing';
import { buildMockStore, MOCK_PRODUCTS } from './_mock';

export const dynamic = 'force-dynamic';

/**
 * Template preview — renders the real Storefront component for the given
 * template id, using mock store config + mock products. No DB, no network.
 *
 * Lives in the (preview) route group on purpose: same URL as before
 * (/admin/templates/{id}/preview) but WITHOUT the admin chrome (sidebar,
 * agent rail, dark content card), so the storefront renders truly full-bleed.
 *
 * Component mapping via pickStorefrontComponent() — same logic as production.
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
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 py-2.5 text-sm backdrop-blur-sm">
        <Link
          href="/admin/templates"
          className="flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-900"
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
        <Badge color="zinc" className="font-mono">
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
