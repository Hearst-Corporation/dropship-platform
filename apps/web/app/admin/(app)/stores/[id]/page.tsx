import { notFound } from "next/navigation";
import { getDbRead } from "@/lib/db";
import { resolveStoreId } from "@/lib/resolve-store";
import { loadStoreReport } from "@/lib/agent/store-report";
import { StoreAvatar } from "@/components/ui";
import { StoreActions } from "../StoreActions";
import { RunReportSections } from "./RunReportSections";
import { Heading } from "@/components/catalyst/heading";
import { Text, TextLink, Strong, Code } from "@/components/catalyst/text";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/catalyst/button";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "@/components/catalyst/description-list";

export const dynamic = "force-dynamic";

interface StoreDetailRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  tagline: string;
  description: string;
  logo_emoji: string;
  primary_color: string;
  accent_color: string;
  status: string;
  product_count: number;
  medusa_sales_channel_id: string | null;
  medusa_publishable_key: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  ga4_measurement_id: string | null;
  ga4_api_secret: string | null;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_events_token: string | null;
  clarity_id: string | null;
  google_ads_conversion_action: string | null;
  google_merchant_id: string | null;
  template: "auto" | "mono" | "collection-grid" | "collection-editorial";
  custom_domain: string | null;
}

interface ProductRow {
  id: string;
  supplier: string;
  enriched_title: string;
  enriched_description: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  supplier_url: string | null;
  medusa_product_id: string | null;
  created_at: string;
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  const [storeRes, productsRes, runReport] = await Promise.all([
    db.query<StoreDetailRow>(
      `SELECT id, slug, name, niche, tagline, description, logo_emoji, primary_color, accent_color,
            status, product_count, medusa_sales_channel_id, medusa_publishable_key,
            error_message, created_at, updated_at,
            ga4_measurement_id, ga4_api_secret,
            meta_pixel_id, meta_capi_token,
            tiktok_pixel_id, tiktok_events_token, clarity_id,
            google_ads_conversion_action, google_merchant_id,
            template, custom_domain
     FROM dropship_stores WHERE id = $1 LIMIT 1`,
      [storeId],
    ),
    db.query<ProductRow>(
      `SELECT id, supplier, enriched_title, enriched_description, price_cents, cost_cents,
            image_url, supplier_url, medusa_product_id, created_at
     FROM dropship_store_products WHERE store_id = $1 ORDER BY created_at ASC LIMIT 500`,
      [storeId],
    ),
    loadStoreReport(db, storeId),
  ]);

  const store = storeRes.rows[0];
  if (!store) notFound();

  const products = productsRes.rows;

  const margin =
    products.length > 0
      ? products.reduce((sum, p) => sum + (p.price_cents - p.cost_cents), 0) /
        products.length /
        100
      : 0;

  const avgPrice =
    products.length > 0
      ? products.reduce((sum, p) => sum + p.price_cents, 0) /
        products.length /
        100
      : 0;

  const supplierCounts = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.supplier] = (acc[p.supplier] || 0) + 1;
    return acc;
  }, {});

  const statusActive = store.status === "active";

  const kpis = [
    { label: "Produits", value: products.length.toString() },
    { label: "Prix moyen", value: `${avgPrice.toFixed(2)} €` },
    { label: "Marge moy.", value: `${margin.toFixed(2)} €` },
    { label: "Statut", value: statusActive ? "En ligne" : store.status },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Text className="text-xs/5 uppercase tracking-wide">Boutique</Text>
          <Heading className="mt-1 flex items-center gap-3">
            <StoreAvatar slug={store.slug} name={store.name} size={40} />
            <span className="min-w-0 truncate">{store.name}</span>
          </Heading>
          {store.tagline && <Text className="mt-1">{store.tagline}</Text>}
        </div>
        <div className="shrink-0">
          <StoreActions storeId={store.id} storeName={store.name} />
        </div>
      </div>

      <AdminSection title="Indicateurs">
        <AdminStatsGrid cols={4}>
          {kpis.map((kpi) => (
            <AdminStatCard key={kpi.label} label={kpi.label} value={kpi.value} />
          ))}
        </AdminStatsGrid>
      </AdminSection>

      <AdminSection
        title="Informations"
        actions={
          <AdminBadge status={statusActive ? "active" : store.status}>
            {statusActive ? "En ligne" : store.status}
          </AdminBadge>
        }
      >
        <DescriptionList className="sm:grid-cols-2">
          <DescriptionTerm>Niche</DescriptionTerm>
          <DescriptionDetails>{store.niche || "—"}</DescriptionDetails>

          <DescriptionTerm>Fournisseurs</DescriptionTerm>
          <DescriptionDetails>
            {Object.entries(supplierCounts)
              .map(([s, count]) => `${s} (${count})`)
              .join(", ") || "—"}
          </DescriptionDetails>

          {store.medusa_publishable_key && (
            <>
              <DescriptionTerm>Clé API</DescriptionTerm>
              <DescriptionDetails>
                <Code>{store.medusa_publishable_key.slice(0, 24)}&hellip;</Code>
              </DescriptionDetails>
            </>
          )}

          {store.description && (
            <>
              <DescriptionTerm>Description</DescriptionTerm>
              <DescriptionDetails>{store.description}</DescriptionDetails>
            </>
          )}

          <DescriptionTerm>Domaine</DescriptionTerm>
          <DescriptionDetails>{store.custom_domain || "—"}</DescriptionDetails>

          {store.error_message && !statusActive && (
            <>
              <DescriptionTerm>Erreur</DescriptionTerm>
              <DescriptionDetails>
                <span>{store.error_message}</span>
                <TextLink
                  href={`/admin/stores/new?niche=${encodeURIComponent(store.niche)}&name=${encodeURIComponent(store.name)}`}
                  className="ml-3"
                >
                  Recr&eacute;er ce store
                </TextLink>
              </DescriptionDetails>
            </>
          )}
        </DescriptionList>
      </AdminSection>

      <AdminSection
        title="Catalogue"
        actions={
          <Button
            color="indigo"
            href={`/admin/stores/${store.id}/catalog`}
            className="shrink-0"
          >
            Voir le catalogue
          </Button>
        }
      >
        <Text>
          <Strong>{products.length}</Strong> produit
          {products.length > 1 ? "s" : ""} import&eacute;
          {products.length > 1 ? "s" : ""}.
        </Text>
      </AdminSection>

      <RunReportSections report={runReport} />
    </div>
  );
}
