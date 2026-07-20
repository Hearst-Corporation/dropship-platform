import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import {
  TEMPLATE_CATALOG,
  type TemplateRegister,
} from "@/lib/template-catalog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { Text } from "@/components/catalyst/text";

export const dynamic = "force-dynamic";

async function fileExists(rel: string): Promise<boolean> {
  try {
    await fs.stat(path.join(process.cwd(), "public", rel));
    return true;
  } catch {
    return false;
  }
}

async function resolvePreview(id: string): Promise<string | null> {
  const candidates = [
    `template-previews/${id}-rendered.png`,
    `template-previews/${id}-source.png`,
  ];
  for (const c of candidates) {
    if (await fileExists(c)) return `/${c}`;
  }
  return null;
}

export default async function TemplatesGalleryPage() {
  // Resolve preview URLs in parallel — keeps the page fast even with 26 entries.
  const previews = await Promise.all(
    TEMPLATE_CATALOG.map(async (t) => ({
      id: t.id,
      preview: await resolvePreview(t.id),
    })),
  );
  const previewByid = Object.fromEntries(
    previews.map((p) => [p.id, p.preview]),
  );

  // Group by register so the gallery reads as a hierarchy: luxury first,
  // premium next, mass at the bottom. Within each group templates stay in
  // catalog order.
  const byRegister: Record<
    TemplateRegister,
    (typeof TEMPLATE_CATALOG)[number][]
  > = {
    luxury: [],
    premium: [],
    mass: [],
  };
  for (const t of TEMPLATE_CATALOG) {
    if (t.id === "auto") continue;
    byRegister[t.register].push(t);
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Templates de storefront"
        subtitle={`${TEMPLATE_CATALOG.length - 1} layouts disponibles. Chaque template peut être assigné à n'importe quelle boutique. Clique sur "Voir en live" pour un preview rendu avec des données fictives.`}
      />

      {(["luxury", "premium", "mass"] as TemplateRegister[]).map((reg) => {
        const entries = byRegister[reg];
        if (!entries.length) return null;
        return (
          <AdminSection
            key={reg}
            title={labelForRegister(reg)}
            actions={
              <Text className="!text-xs">{entries.length} templates</Text>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {entries.map((t) => {
                const preview = previewByid[t.id];
                // Une seule ligne de méta en texte discret plutôt qu'une rangée
                // de badges : l'aperçu et le nom doivent porter la carte.
                const meta = [
                  t.mode,
                  t.niches.length > 0 ? t.niches[0] : "tous secteurs",
                  t.niches.length > 1 ? `+${t.niches.length - 1}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Link
                    key={t.id}
                    href={`/admin/templates/${t.id}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-w-0 flex-col overflow-hidden bg-admin-surface-panel ring-1 ring-admin-ring transition hover:ring-admin-ring-strong"
                  >
                    <div className="relative block aspect-[16/10] w-full overflow-hidden bg-admin-surface-panel">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt={t.label}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-admin-surface-panel">
                          <Squares2X2Icon
                            className="size-6 text-zinc-400"
                            aria-hidden="true"
                          />
                          <span className="text-xs font-medium text-zinc-500">
                            Aperçu à générer
                          </span>
                        </div>
                      )}
                      {/* Repère de registre : évite que toutes les vignettes se
                          ressemblent quand le rendu est encore générique. */}
                      <span className="absolute left-0 top-0 bg-black/55 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white/85 backdrop-blur-sm">
                        {t.register}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
                      <h3 className="truncate text-sm font-semibold text-white">
                        {t.label}
                      </h3>
                      <Text className="line-clamp-2 !text-xs">{t.hint}</Text>
                      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                        <span className="truncate text-xs text-zinc-500">
                          {meta}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-zinc-400 transition-colors group-hover:text-indigo-400">
                          Voir en live &#8594;
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </AdminSection>
        );
      })}
    </div>
  );
}

function labelForRegister(r: TemplateRegister): string {
  switch (r) {
    case "luxury":
      return "Luxe · pièces signatures";
    case "premium":
      return "Premium · éditorial et boutique";
    case "mass":
      return "Mass-market · volume et grandes audiences";
  }
}
