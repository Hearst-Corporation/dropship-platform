import { notFound } from "next/navigation";
import { getDbRead } from "@/lib/db";
import { resolveStoreId } from "@/lib/resolve-store";
import { CopilotHub, type ProductSummary } from "./CopilotHub";

export default async function StoreCopilot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();

  const db = getDbRead();

  const storeRes = await db.query<{ id: string; slug: string; name: string }>(
    `SELECT id, slug, name FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const productsRes = await db.query<ProductSummary>(
    `SELECT id, enriched_title, price_cents, image_url
       FROM dropship_store_products
      WHERE store_id = $1
      ORDER BY created_at ASC`,
    [storeId],
  );

  return (
    <CopilotHub
      storeId={store.id}
      storeSlug={store.slug}
      storeName={store.name}
      initialProducts={productsRes.rows}
    />
  );
}
