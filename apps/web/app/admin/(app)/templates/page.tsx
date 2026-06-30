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
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/catalyst/table';

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
            <Table dense className="[--gutter:--spacing(6)]">
              <TableHead>
                <TableRow>
                  <TableHeader>Aperçu</TableHeader>
                  <TableHeader>Template</TableHeader>
                  <TableHeader>Mode</TableHeader>
                  <TableHeader>Niches</TableHeader>
                  <TableHeader>Identifiant</TableHeader>
                  <TableHeader className="text-right">Action</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((t) => {
                  const preview = previewByid[t.id];
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="relative h-12 w-20 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-950">
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={preview}
                              alt={t.label}
                              className="absolute inset-0 h-full w-full object-cover object-top"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-zinc-500">
                              N/A
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Strong>{t.label}</Strong>
                          <Text className="line-clamp-2 max-w-md !text-xs">{t.hint}</Text>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color="zinc">{t.mode}</Badge>
                      </TableCell>
                      <TableCell>
                        {t.niches.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {t.niches.map((n) => (
                              <Badge key={n} color="indigo">
                                {n}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Text className="!text-xs text-zinc-500">Tous secteurs</Text>
                        )}
                      </TableCell>
                      <TableCell>
                        <Code>{t.id}</Code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          href={`/admin/templates/${t.id}/preview`}
                          plain
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Voir en live &#8594;
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
