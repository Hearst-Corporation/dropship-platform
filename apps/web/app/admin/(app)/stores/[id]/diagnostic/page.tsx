import { notFound } from "next/navigation";
import { getDbRead } from "@/lib/db";
import { resolveStoreId } from "@/lib/resolve-store";
import {
  evaluateStoreReadiness,
  detectSmartComponents,
} from "@/lib/agent/store-readiness";
import { loadStoreReport } from "@/lib/agent/store-report";
import { StoreAvatar } from "@/components/ui";
import { Heading, Subheading } from "@/components/catalyst/heading";
import { Text, Strong, Code } from "@/components/catalyst/text";
import { Button } from "@/components/catalyst/button";
import { Badge } from "@/components/catalyst/badge";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { SmartReadinessPanel } from "@/components/smart";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "@/components/catalyst/description-list";
export const dynamic = "force-dynamic";
interface StoreDiagnosticRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  status: string;
  template: string;
  mode: "mono" | "collection";
  hero_image_url: string | null;
  cutout_image_url: string | null;
  lifestyle_images: unknown;
  promo_video_url: string | null;
  assets_status: string;
  landing_content: unknown;
  run_id: string | null;
  error_phase: string | null;
  error_path: string | null;
  error_expected: string | null;
  error_received: string | null;
  error_raw_excerpt: string | null;
  error_message: string | null;
  readiness_score: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
interface ProductDiagnosticRow {
  id: string;
  supplier: string;
  enriched_title: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  medusa_product_id: string | null;
  image_quality_score: number | null;
}
export default async function StoreDiagnosticPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();
  const [storeRes, productsRes, runReport] = await Promise.all([
    db.query<StoreDiagnosticRow>(
      `SELECT id, slug, name, niche, status, template, mode, hero_image_url, cutout_image_url, lifestyle_images, promo_video_url, assets_status, landing_content, run_id, error_phase, error_path, error_expected, error_received, error_raw_excerpt, error_message, readiness_score, published_at, created_at, updated_at FROM dropship_stores WHERE id = $1 LIMIT 1`,
      [storeId],
    ),
    db.query<ProductDiagnosticRow>(
      `SELECT id, supplier, enriched_title, price_cents, cost_cents, image_url, medusa_product_id, image_quality_score FROM dropship_store_products WHERE store_id = $1 ORDER BY created_at ASC`,
      [storeId],
    ),
    loadStoreReport(db, storeId),
  ]);
  const store = storeRes.rows[0];
  if (!store) notFound();
  const products = productsRes.rows;
  const readiness = await evaluateStoreReadiness(storeId);
  const smartComponents = detectSmartComponents(store.landing_content);
  const isRecoverable = [
    "draft",
    "generating",
    "validating",
    "needs_repair",
    "failed",
  ].includes(store.status);
  const isPublished = store.status === "published";
  return (
    <div className="space-y-8">
      {" "}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {" "}
        <div className="min-w-0">
          {" "}
          <Text className="text-xs/5 uppercase tracking-wide">
            Diagnostic
          </Text>{" "}
          <Heading className="mt-1 flex items-center gap-3">
            {" "}
            <StoreAvatar slug={store.slug} name={store.name} size={40} />{" "}
            <span className="min-w-0 truncate">{store.name}</span>{" "}
          </Heading>{" "}
        </div>{" "}
        <div className="shrink-0 flex items-center gap-2">
          {" "}
          <Button plain href={`/admin/stores/${store.id}`}>
            {" "}
            Retour au store{" "}
          </Button>{" "}
          {isRecoverable && (
            <Button
              color="indigo"
              href={`/admin/stores/${store.id}/diagnostic?action=retry`}
            >
              {" "}
              Relancer la génération{" "}
            </Button>
          )}{" "}
          {isPublished && (
            <Button
              plain
              href={`/shop/${store.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              {" "}
              Voir le store{" "}
            </Button>
          )}{" "}
        </div>{" "}
      </div>{" "}
      <SmartReadinessPanel storeId={store.id} initial={readiness} />{" "}
      <section className="border-t border-admin-border pt-8">
        {" "}
        <Subheading>Statut et identité</Subheading>{" "}
        <DescriptionList className="mt-4 sm:grid-cols-2">
          {" "}
          <DescriptionTerm>Statut</DescriptionTerm>{" "}
          <DescriptionDetails>
            {" "}
            <AdminBadge status={store.status}>{store.status}</AdminBadge>{" "}
          </DescriptionDetails>{" "}
          <DescriptionTerm>Slug</DescriptionTerm>{" "}
          <DescriptionDetails>{store.slug}</DescriptionDetails>{" "}
          <DescriptionTerm>Niche</DescriptionTerm>{" "}
          <DescriptionDetails>{store.niche}</DescriptionDetails>{" "}
          <DescriptionTerm>Template</DescriptionTerm>{" "}
          <DescriptionDetails>{store.template || "auto"}</DescriptionDetails>{" "}
          <DescriptionTerm>Mode</DescriptionTerm>{" "}
          <DescriptionDetails>{store.mode}</DescriptionDetails>{" "}
          <DescriptionTerm>Run ID</DescriptionTerm>{" "}
          <DescriptionDetails>
            {" "}
            {store.run_id ? <Code>{store.run_id}</Code> : "—"}{" "}
          </DescriptionDetails>{" "}
          <DescriptionTerm>Readiness score</DescriptionTerm>{" "}
          <DescriptionDetails>{store.readiness_score}</DescriptionDetails>{" "}
          <DescriptionTerm>Publié le</DescriptionTerm>{" "}
          <DescriptionDetails>
            {store.published_at
              ? new Date(store.published_at).toLocaleString("fr-FR")
              : "—"}
          </DescriptionDetails>{" "}
        </DescriptionList>{" "}
      </section>{" "}
      {store.error_message && (
        <section className="border-t border-admin-border pt-8">
          {" "}
          <div className="flex items-start justify-between gap-4">
            {" "}
            <Subheading>Erreur du dernier run</Subheading>{" "}
            <Badge color="red">{store.error_phase || "unknown"}</Badge>{" "}
          </div>{" "}
          <DescriptionList className="mt-4 sm:grid-cols-2">
            {" "}
            <DescriptionTerm>Message</DescriptionTerm>{" "}
            <DescriptionDetails>{store.error_message}</DescriptionDetails>{" "}
            <DescriptionTerm>Path</DescriptionTerm>{" "}
            <DescriptionDetails>{store.error_path || "—"}</DescriptionDetails>{" "}
            <DescriptionTerm>Expected</DescriptionTerm>{" "}
            <DescriptionDetails>
              {store.error_expected || "—"}
            </DescriptionDetails>{" "}
            <DescriptionTerm>Received</DescriptionTerm>{" "}
            <DescriptionDetails>
              {store.error_received || "—"}
            </DescriptionDetails>{" "}
            <DescriptionTerm>Raw excerpt</DescriptionTerm>{" "}
            <DescriptionDetails>
              {" "}
              {store.error_raw_excerpt ? (
                <Code className="block max-w-full overflow-x-auto whitespace-pre-wrap">
                  {" "}
                  {store.error_raw_excerpt}{" "}
                </Code>
              ) : (
                "—"
              )}{" "}
            </DescriptionDetails>{" "}
          </DescriptionList>{" "}
        </section>
      )}{" "}
      <section className="border-t border-admin-border pt-8">
        {" "}
        <Subheading>Produits</Subheading>{" "}
        <Text className="mt-1">
          {" "}
          <Strong>{products.length}</Strong> produit
          {products.length > 1 ? "s" : ""} généré{" "}
          {products.length > 1 ? "s" : ""}.{" "}
        </Text>{" "}
        {products.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {" "}
            {products.map((p) => (
              <div
                key={p.id}
                className="rounded-lg p-4 ring-1 ring-admin-ring"
              >
                {" "}
                <Text className="font-medium text-white">
                  {p.enriched_title}
                </Text>{" "}
                <Text className="text-xs text-zinc-500">
                  {" "}
                  {p.supplier} · {(p.price_cents / 100).toFixed(2)} €{" "}
                </Text>{" "}
                <Text className="text-xs text-zinc-500">
                  {" "}
                  Medusa:{" "}
                  {p.medusa_product_id ? (
                    <span className="text-green-400">ok</span>
                  ) : (
                    <span className="text-zinc-500">local</span>
                  )}{" "}
                </Text>{" "}
                {p.image_quality_score != null && (
                  <Text className="text-xs text-zinc-500">
                    {" "}
                    Qualité image: {p.image_quality_score}{" "}
                  </Text>
                )}{" "}
              </div>
            ))}{" "}
          </div>
        )}{" "}
      </section>{" "}
      <section className="border-t border-admin-border pt-8">
        {" "}
        <Subheading>Assets</Subheading>{" "}
        <DescriptionList className="mt-4 sm:grid-cols-2">
          {" "}
          <DescriptionTerm>Status assets</DescriptionTerm>{" "}
          <DescriptionDetails>{store.assets_status}</DescriptionDetails>{" "}
          <DescriptionTerm>Hero</DescriptionTerm>{" "}
          <DescriptionDetails>
            {store.hero_image_url ? "✓" : "✗"}
          </DescriptionDetails>{" "}
          <DescriptionTerm>Cutout</DescriptionTerm>{" "}
          <DescriptionDetails>
            {store.cutout_image_url ? "✓" : "✗"}
          </DescriptionDetails>{" "}
          <DescriptionTerm>Lifestyles</DescriptionTerm>{" "}
          <DescriptionDetails>
            {" "}
            {Array.isArray(store.lifestyle_images)
              ? store.lifestyle_images.length
              : 0}{" "}
          </DescriptionDetails>{" "}
          <DescriptionTerm>Vidéo</DescriptionTerm>{" "}
          <DescriptionDetails>
            {store.promo_video_url ? "✓" : "✗"}
          </DescriptionDetails>{" "}
        </DescriptionList>{" "}
      </section>{" "}
      <section className="border-t border-admin-border pt-8">
        {" "}
        <Subheading>Smart components détectés</Subheading>{" "}
        {smartComponents.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {" "}
            {smartComponents.map((c) => (
              <Badge key={c} color="zinc">
                {" "}
                {c}{" "}
              </Badge>
            ))}{" "}
          </div>
        ) : (
          <Text className="mt-1 text-zinc-500">
            Aucun smart component détecté dans la landing.
          </Text>
        )}{" "}
      </section>{" "}
      {runReport && (
        <section className="border-t border-admin-border pt-8">
          {" "}
          <Subheading>Logs du run</Subheading>{" "}
          <div className="mt-4 max-h-80 overflow-y-auto rounded-lg p-4 ring-1 ring-admin-ring">
            {" "}
            <div className="flex flex-col gap-1 font-mono text-xs">
              {" "}
              {runReport.events.map((e, i) => (
                <div key={i} className="flex items-start gap-3">
                  {" "}
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {" "}
                    {e.ts.slice(11, 19)}{" "}
                  </span>{" "}
                  <span
                    className={
                      e.type === "error"
                        ? "font-medium text-white"
                        : e.type === "success"
                          ? "text-indigo-400"
                          : e.type === "step"
                            ? "font-medium text-white"
                            : "text-zinc-500"
                    }
                  >
                    {" "}
                    {e.message}{" "}
                  </span>{" "}
                </div>
              ))}{" "}
            </div>{" "}
          </div>{" "}
        </section>
      )}{" "}
    </div>
  );
}
