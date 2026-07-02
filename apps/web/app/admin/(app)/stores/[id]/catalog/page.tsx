import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { Badge } from '@/components/catalyst/badge';
import { Button } from '@/components/catalyst/button';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { EllipsisHorizontalIcon } from '@heroicons/react/16/solid';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/catalyst/dropdown';
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from '@/components/catalyst/description-list';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/catalyst/table';

export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string;
  supplier: string;
  external_id: string;
  supplier_url: string | null;
  enriched_title: string;
  enriched_description: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  medusa_product_id: string | null;
  image_quality_score: string | null; // numeric(3,2) comes back as string
  created_at: string;
}

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  logo_emoji: string;
  niche: string;
}

export default async function StoreCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  const storeRes = await db.query<StoreRow>(
    `SELECT id, slug, name, logo_emoji, niche FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const { rows: products } = await db.query<ProductRow>(
    `SELECT id, supplier, external_id, supplier_url, enriched_title, enriched_description,
            price_cents, cost_cents, image_url, medusa_product_id,
            image_quality_score, created_at
       FROM dropship_store_products
      WHERE store_id = $1
      ORDER BY created_at ASC
      LIMIT 500`,
    [storeId],
  );

  const totalRetailCents = products.reduce((s, p) => s + p.price_cents, 0);
  const totalCostCents = products.reduce((s, p) => s + p.cost_cents, 0);
  const totalMarginCents = totalRetailCents - totalCostCents;
  const avgMargin = products.length > 0 ? totalMarginCents / products.length / 100 : 0;
  const avgPrice = products.length > 0 ? totalRetailCents / products.length / 100 : 0;

  const supplierCounts = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.supplier] = (acc[p.supplier] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: 'Produits', value: products.length.toString() },
    { label: 'Prix moyen', value: `${avgPrice.toFixed(2)} €` },
    { label: 'Marge moy.', value: `${avgMargin.toFixed(2)} €` },
    { label: 'Fournisseurs', value: Object.keys(supplierCounts).length.toString() },
  ];

  return (
    <div className="space-y-8">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Text className="text-xs/5 font-medium uppercase tracking-wider">Catalogue</Text>
          <Heading>Produits du store</Heading>
          <Text>
            Niche · {store.niche} · Géré par l&apos;agent à la création, modifiable via Curation.
          </Text>
        </div>
        <Button color="indigo" href={`/admin/stores/${id}/copilot`}>
          Discuter avec le copilote
        </Button>
      </div>

      <div className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <Subheading>Aperçu</Subheading>
        <div className="grid grid-cols-1 gap-x-8 2xl:grid-cols-2">
          {[stats.slice(0, 2), stats.slice(2)].map((half, i) => (
            <DescriptionList key={i} className="mt-4">
              {half.map((stat) => (
                <Fragment key={stat.label}>
                  <DescriptionTerm>{stat.label}</DescriptionTerm>
                  <DescriptionDetails className="tabular-nums">{stat.value}</DescriptionDetails>
                </Fragment>
              ))}
            </DescriptionList>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Subheading>
            {products.length} produit{products.length > 1 ? 's' : ''}
          </Subheading>
          {Object.entries(supplierCounts).length > 0 ? (
            <Text className="text-xs">
              {Object.entries(supplierCounts)
                .map(([s, c]) => `${s}·${c}`)
                .join(' / ')}
            </Text>
          ) : null}
        </div>

        {products.length === 0 ? (
          <AdminEmptyState
            title="Aucun produit dans ce store"
            description="Lance le copilote de curation pour en importer."
            action={
              <Button color="indigo" href={`/admin/stores/${id}/copilot`}>
                Ajouter des produits
              </Button>
            }
          />
        ) : (
          <Table className="mt-4" dense>
            <TableHead>
              <TableRow>
                <TableHeader>Produit</TableHeader>
                <TableHeader>Source</TableHeader>
                <TableHeader className="text-right">Coût</TableHeader>
                <TableHeader className="text-right">Prix</TableHeader>
                <TableHeader className="text-right">Marge</TableHeader>
                <TableHeader className="text-right">Image</TableHeader>
                <TableHeader className="text-right">État</TableHeader>
                <TableHeader className="relative w-0">
                  <span className="sr-only">Actions</span>
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((p) => {
                const margin = (p.price_cents - p.cost_cents) / 100;
                const marginPct =
                  p.cost_cents > 0
                    ? Math.round(((p.price_cents - p.cost_cents) / p.cost_cents) * 100)
                    : 0;
                const supplierColor = 'zinc';
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.enriched_title || 'Produit'}
                              loading="lazy"
                              decoding="async"
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-lg">
                              {store.logo_emoji}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="max-w-[28ch] truncate font-medium text-zinc-950 dark:text-white">
                            {p.enriched_title}
                          </div>
                          <Text className="mt-0.5 max-w-[36ch] truncate text-xs">
                            {p.enriched_description}
                          </Text>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge color={supplierColor}>{p.supplier}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500">
                      {(p.cost_cents / 100).toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-zinc-950 dark:text-white">
                      {(p.price_cents / 100).toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium text-indigo-500">+{margin.toFixed(2)} €</span>
                      <span className="block text-xs text-zinc-500">{marginPct}%</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500">
                      {p.image_quality_score != null
                        ? `${Math.round(parseFloat(p.image_quality_score) * 100)}%`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.medusa_product_id ? (
                        <AdminBadge status="live">Live</AdminBadge>
                      ) : (
                        <AdminBadge status="pending">En attente</AdminBadge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="-my-1.5 flex justify-end">
                        <Dropdown>
                          <DropdownButton plain aria-label={`Actions pour ${p.enriched_title || 'ce produit'}`}>
                            <EllipsisHorizontalIcon data-slot="icon" />
                          </DropdownButton>
                          <DropdownMenu anchor="bottom end">
                            <DropdownItem href={`/shop/${store.slug}`} target="_blank" rel="noreferrer">
                              <DropdownLabel>Voir sur la boutique</DropdownLabel>
                            </DropdownItem>
                            {p.supplier_url ? (
                              <DropdownItem href={p.supplier_url} target="_blank" rel="noreferrer">
                                <DropdownLabel>Ouvrir chez le fournisseur</DropdownLabel>
                              </DropdownItem>
                            ) : null}
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
