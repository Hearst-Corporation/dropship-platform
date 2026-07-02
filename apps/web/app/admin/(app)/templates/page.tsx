import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import {
  TEMPLATE_CATALOG,
  type TemplateRegister,
} from "@/lib/template-catalog";
import { Subheading } from "@/components/catalyst/heading";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { Text, Code, Strong } from "@/components/catalyst/text";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";

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
                return (
                  <div
                    key={t.id}
                    className="flex min-w-0 flex-col overflow-hidden bg-admin-surface-panel ring-1 ring-admin-ring transition hover:ring-admin-ring-strong"
                  >
                    <Link
                      href={`/admin/templates/${t.id}/preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-[16/10] w-full overflow-hidden bg-admin-surface-panel"
                    >
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
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <Strong>{t.label}</Strong>
                        <Text className="line-clamp-2 !text-xs">{t.hint}</Text>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge color="zinc">{t.mode}</Badge>
                        {t.niches.length > 0 ? (
                          <>
                            {t.niches.slice(0, 3).map((n) => (
                              <Badge key={n} color="indigo">
                                {n}
                              </Badge>
                            ))}
                            {t.niches.length > 3 && (
                              <Badge color="zinc">+{t.niches.length - 3}</Badge>
                            )}
                          </>
                        ) : (
                          <Badge color="zinc">Tous secteurs</Badge>
                        )}
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                        <Code className="truncate">{t.id}</Code>
                        <Button
                          href={`/admin/templates/${t.id}/preview`}
                          plain
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Voir en live &#8594;
                        </Button>
                      </div>
                    </div>
                  </div>
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
