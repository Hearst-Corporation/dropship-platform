import { notFound } from "next/navigation";
import type React from "react";
import { TEMPLATE_CATALOG } from "@/lib/template-catalog";
import { pickStorefrontComponent } from "@/lib/storefront-routing";
import { resolveDesign } from "@/lib/design/runtime";
import { buildMockStore, mockProductsForTemplate } from "./_mock";
import Link from "next/link";
import { Badge } from "@/components/catalyst/badge";

export const dynamic = "force-dynamic";

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
  if (id === "auto") notFound();

  const entry = TEMPLATE_CATALOG.find((t) => t.id === id);
  if (!entry) notFound();

  const store = buildMockStore(id, entry.label);
  const products = mockProductsForTemplate(id);

  // Resolve the same locked design system the real storefront layout applies
  // (design/runtime.ts) so each template previews with its true palette +
  // fonts instead of the generic default. Without this, every template
  // rendered identically (black/violet, system fonts).
  const design = resolveDesign(store);

  const storefrontJsx = pickStorefrontComponent(entry, { store, products });

  return (
    <div>
      {/* Admin header bar */}
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-admin-border-strong bg-admin-preview-chrome px-4 py-2.5 text-sm backdrop-blur-sm">
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
        <span className="text-zinc-400">/</span>
        <span className="font-semibold text-zinc-900">{entry.label}</span>
        <Badge color="zinc" className="font-mono">
          {id}
        </Badge>
        <span className="ml-auto rounded-full bg-admin-surface-inset px-2.5 py-0.5 text-xs font-medium text-zinc-400">
          Apercu avec donnees fictives
        </span>
      </div>

      {/* Full-bleed storefront render — wrapped in the locked design system
          exactly like app/shop/[slug]/layout.tsx, so --ds-* vars + Google
          Fonts resolve and each template shows its true identity. */}
      <div
        style={
          {
            "--primary": design.palette.primary,
            "--accent": design.palette.accent,
            fontFamily: "var(--ds-font-body)",
            color: "var(--ds-text)",
            backgroundColor: "var(--ds-bg)",
          } as React.CSSProperties
        }
      >
        {design.googleFontsUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={design.googleFontsUrl} />
          </>
        )}
        <style dangerouslySetInnerHTML={{ __html: design.cssVars }} />
        {storefrontJsx}
      </div>
    </div>
  );
}
