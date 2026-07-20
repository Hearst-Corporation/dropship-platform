import { notFound } from "next/navigation";
import { getDbRead } from "@/lib/db";
import { resolveStoreId } from "@/lib/resolve-store";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminAssetCell } from "@/components/admin/AdminAssetCell";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { AdminSection } from "@/components/admin/AdminSection";
import { EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from "@/components/ui/dropdown";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

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

export default async function StoreCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  // Les deux requêtes ne dépendent que de storeId : les enchaîner coûtait un
  // aller-retour de plus vers Railway à chaque rendu (page force-dynamic).
  const [storeRes, productsRes] = await Promise.all([
    db.query<StoreRow>(
      `SELECT id, slug, name, logo_emoji, niche FROM dropship_stores WHERE id = $1 LIMIT 1`,
      [storeId],
    ),
    db.query<ProductRow>(
      `SELECT id, supplier, external_id, supplier_url, enriched_title, enriched_description,
            price_cents, cost_cents, image_url, medusa_product_id,
            image_quality_score, created_at
       FROM dropship_store_products
      WHERE store_id = $1
      ORDER BY created_at ASC
      LIMIT 500`,
      [storeId],
    ),
  ]);

  const store = storeRes.rows[0];
  if (!store) notFound();

  const products = productsRes.rows;

  const totalRetailCents = products.reduce((s, p) => s + p.price_cents, 0);
  const totalCostCents = products.reduce((s, p) => s + p.cost_cents, 0);
  const totalMarginCents = totalRetailCents - totalCostCents;
  const avgMargin =
    products.length > 0 ? totalMarginCents / products.length / 100 : 0;
  const avgPrice =
    products.length > 0 ? totalRetailCents / products.length / 100 : 0;

  const supplierCounts = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.supplier] = (acc[p.supplier] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: "Produits", value: products.length.toString() },
    { label: "Prix moyen", value: `${avgPrice.toFixed(2)} €` },
    { label: "Marge moy.", value: `${avgMargin.toFixed(2)} €` },
    {
      label: "Fournisseurs",
      value: Object.keys(supplierCounts).length.toString(),
    },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Produits du store"
        subtitle={`Niche · ${store.niche} · Géré par l'agent à la création, modifiable via Curation.`}
        actions={
          <Button color="indigo" href={`/admin/stores/${id}/copilot`}>
            Discuter avec le copilote
          </Button>
        }
      />

      {/* Stats hors panneau titré : elles sont secondaires par rapport au
          tableau, qui est le vrai contenu de la page. */}
      <AdminStatsGrid cols={4}>
        {stats.map((stat) => (
          <AdminStatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </AdminStatsGrid>

      <AdminSection
        title={`${products.length} produit${products.length > 1 ? "s" : ""}`}
        description={
          Object.entries(supplierCounts).length > 0
            ? Object.entries(supplierCounts)
                .map(([s, c]) => `${s} · ${c}`)
                .join(" / ")
            : undefined
        }
        flush={products.length > 0}
      >
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
          <AdminDataTable fixedLayout>
            <Table dense bleed>
              <colgroup>
                <col />
                <col style={{ width: "6rem" }} />
                <col style={{ width: "4.5rem" }} />
                <col style={{ width: "5rem" }} />
                <col style={{ width: "5.5rem" }} />
                <col style={{ width: "4rem" }} />
                <col style={{ width: "5rem" }} />
                <col style={{ width: "3rem" }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  <TableHeader>Produit</TableHeader>
                  <TableHeader className="whitespace-nowrap hidden sm:table-cell">
                    Source
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right hidden md:table-cell">
                    Coût
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right">
                    Prix
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right hidden sm:table-cell">
                    Marge
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right hidden lg:table-cell">
                    Image
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right">
                    État
                  </TableHeader>
                  <TableHeader className="whitespace-nowrap text-right">
                    <span className="sr-only">Actions</span>
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((p) => {
                  const margin = (p.price_cents - p.cost_cents) / 100;
                  const marginPct =
                    p.cost_cents > 0
                      ? Math.round(
                          ((p.price_cents - p.cost_cents) / p.cost_cents) * 100,
                        )
                      : 0;
                  const supplierColor = "zinc";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="min-w-0">
                        <AdminAssetCell
                          imageUrl={p.image_url}
                          title={p.enriched_title}
                          subtitle={p.enriched_description}
                        />
                      </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge color={supplierColor}>{p.supplier}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500 hidden md:table-cell">
                      {(p.cost_cents / 100).toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-white">
                      {(p.price_cents / 100).toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">
                      <span className="font-medium text-indigo-500">
                        +{margin.toFixed(2)} €
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {marginPct}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500 hidden lg:table-cell">
                      {p.image_quality_score != null
                        ? `${Math.round(parseFloat(p.image_quality_score) * 100)}%`
                        : "—"}
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
                          <DropdownButton
                            plain
                            aria-label={`Actions pour ${p.enriched_title || "ce produit"}`}
                          >
                            <EllipsisHorizontalIcon data-slot="icon" />
                          </DropdownButton>
                          <DropdownMenu anchor="bottom end">
                            <DropdownItem
                              href={`/shop/${store.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <DropdownLabel>
                                Voir sur la boutique
                              </DropdownLabel>
                            </DropdownItem>
                            {p.supplier_url ? (
                              <DropdownItem
                                href={p.supplier_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <DropdownLabel>
                                  Ouvrir chez le fournisseur
                                </DropdownLabel>
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
          </AdminDataTable>
        )}
      </AdminSection>
    </div>
  );
}
