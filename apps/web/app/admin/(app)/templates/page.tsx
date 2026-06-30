import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import {
  TEMPLATE_CATALOG,
  type TemplateRegister,
} from '@/lib/template-catalog';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminBadge } from '@/components/admin/AdminBadge';

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
      <AdminPageHeader
        eyebrow="Catalogue"
        title={
          <span>
            Templates <em className="font-normal italic text-gray-400">de storefront</em>
          </span>
        }
        description={`${TEMPLATE_CATALOG.length - 1} layouts disponibles. Chaque template peut être assigné à n'importe quelle boutique. Clique sur "Voir en live" pour un preview rendu avec des données fictives.`}
      />

      {(['luxury', 'premium', 'mass'] as TemplateRegister[]).map((reg) => {
        const entries = byRegister[reg];
        if (!entries.length) return null;
        return (
          <section key={reg} className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                {labelForRegister(reg)}
              </h2>
              <span className="text-xs text-gray-500">{entries.length} templates</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((t) => {
                const preview = previewByid[t.id];
                return (
                  <article
                    key={t.id}
                    className="flex flex-col overflow-hidden rounded-xl bg-gray-800/50 ring-1 ring-white/10"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-gray-900">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt={t.label}
                          className="absolute inset-0 h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-500">
                          Pas d&apos;aper&ccedil;u disponible
                        </div>
                      )}
                      <span className="absolute left-3 top-3">
                        <AdminBadge color="indigo">{t.register}</AdminBadge>
                      </span>
                      <span className="absolute right-3 top-3">
                        <AdminBadge color="zinc">{t.mode}</AdminBadge>
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div>
                        <h3 className="text-[15px] font-semibold tracking-tight text-white">
                          {t.label}
                        </h3>
                        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-400">
                          {t.hint}
                        </p>
                      </div>

                      {t.niches.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {t.niches.map((n) => (
                            <span
                              key={n}
                              className="rounded border border-white/10 bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-gray-400"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {t.moods.slice(0, 3).map((m) => (
                          <span key={m} className="px-1.5 py-0.5 text-[10px] italic text-gray-500">
                            {m}
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                        <code className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-gray-500">
                          {t.id}
                        </code>
                        <Link
                          href={`/admin/templates/${t.id}/preview`}
                          className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Voir en live &#8594;
                        </Link>
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
