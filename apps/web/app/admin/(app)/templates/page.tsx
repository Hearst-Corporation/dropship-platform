import { promises as fs } from 'fs';
import path from 'path';
import {
  TEMPLATE_CATALOG,
  type TemplateRegister,
} from '@/lib/template-catalog';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text, Code, Strong } from '@/components/catalyst/text';
import { Badge } from '@/components/catalyst/badge';
import { Button } from '@/components/catalyst/button';

export const dynamic = 'force-dynamic';

async function fileExists(rel: string): Promise<boolean> {
  try {
    await fs.stat(path.join(process.cwd(), 'public', rel));
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
    TEMPLATE_CATALOG.map(async (t) => ({ id: t.id, preview: await resolvePreview(t.id) })),
  );
  const previewByid = Object.fromEntries(previews.map((p) => [p.id, p.preview]));

  // Group by register so the gallery reads as a hierarchy: luxury first,
  // premium next, mass at the bottom. Within each group templates stay in
  // catalog order.
  const byRegister: Record<TemplateRegister, typeof TEMPLATE_CATALOG[number][]> = {
    luxury: [],
    premium: [],
    mass: [],
  };
  for (const t of TEMPLATE_CATALOG) {
    if (t.id === 'auto') continue;
    byRegister[t.register].push(t);
  }

  return (
    <div className="space-y-8">
      <div>
        <Heading>Templates de storefront</Heading>
        <Text className="mt-2">
          {`${TEMPLATE_CATALOG.length - 1} layouts disponibles. Chaque template peut être assigné à n'importe quelle boutique. Clique sur "Voir en live" pour un preview rendu avec des données fictives.`}
        </Text>
      </div>

      {(['luxury', 'premium', 'mass'] as TemplateRegister[]).map((reg) => {
        const entries = byRegister[reg];
        if (!entries.length) return null;
        return (
          <section key={reg} className="flex min-w-0 flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <Subheading>{labelForRegister(reg)}</Subheading>
              <Text className="text-xs">{entries.length} templates</Text>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {entries.map((t) => {
                const preview = previewByid[t.id];
                return (
                  <div
                    key={t.id}
                    className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-white/[0.02] ring-1 ring-zinc-950/10 dark:ring-white/10"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt={t.label}
                          className="absolute inset-0 h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-zinc-500">
                          Aperçu indisponible
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <Strong>{t.label}</Strong>
                        <Text className="line-clamp-2 !text-xs">{t.hint}</Text>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge color="zinc">{t.mode}</Badge>
                        {t.niches.length > 0 ? (
                          t.niches.map((n) => (
                            <Badge key={n} color="indigo">
                              {n}
                            </Badge>
                          ))
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
          </section>
        );
      })}
    </div>
  );
}

function labelForRegister(r: TemplateRegister): string {
  switch (r) {
    case 'luxury': return 'Luxe — pièces signatures';
    case 'premium': return 'Premium — éditorial et boutique';
    case 'mass': return 'Mass-market — volume et grandes audiences';
  }
}
