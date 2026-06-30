import { promises as fs } from 'fs';
import path from 'path';
import {
  TEMPLATE_CATALOG,
  type TemplateRegister,
} from '@/lib/template-catalog';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
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
    <div className="flex flex-1 flex-col space-y-8 px-6 pb-12">
      <div>
        <Text className="text-xs font-semibold uppercase tracking-[0.18em]">Catalogue</Text>
        <Heading className="mt-1">Templates de storefront</Heading>
        <Text className="mt-2">
          {`${TEMPLATE_CATALOG.length - 1} layouts disponibles. Chaque template peut être assigné à n'importe quelle boutique. Clique sur "Voir en live" pour un preview rendu avec des données fictives.`}
        </Text>
      </div>

      {(['luxury', 'premium', 'mass'] as TemplateRegister[]).map((reg) => {
        const entries = byRegister[reg];
        if (!entries.length) return null;
        return (
          <section key={reg} className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <Subheading>{labelForRegister(reg)}</Subheading>
              <Text className="text-xs">{entries.length} templates</Text>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((t) => {
                const preview = previewByid[t.id];
                return (
                  <article
                    key={t.id}
                    className="flex flex-col overflow-hidden rounded-lg bg-white ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10"
                  >
                    <div className="relative aspect-16/10 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt={t.label}
                          className="absolute inset-0 h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-zinc-500">
                          Pas d&apos;aper&ccedil;u disponible
                        </div>
                      )}
                      <span className="absolute left-3 top-3">
                        <Badge color="indigo">{t.register}</Badge>
                      </span>
                      <span className="absolute right-3 top-3">
                        <Badge color="zinc">{t.mode}</Badge>
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div>
                        <Subheading level={3} className="!text-[15px]">
                          {t.label}
                        </Subheading>
                        <Text className="mt-1 line-clamp-3 !text-xs">
                          {t.hint}
                        </Text>
                      </div>

                      {t.niches.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {t.niches.map((n) => (
                            <Badge key={n} color="zinc">
                              {n}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {t.moods.slice(0, 3).map((m) => (
                          <span key={m} className="px-1.5 py-0.5 text-[10px] italic text-zinc-500">
                            {m}
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-950/5 pt-3 dark:border-white/10">
                        <code className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-zinc-500">
                          {t.id}
                        </code>
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
                  </article>
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
