-- 033_supplier_catalog.sql
-- Generic ingested-feed catalog for feed-only suppliers (Syncee, etc.).
-- Idempotent: safe to run multiple times. Apply after 031.

CREATE TABLE IF NOT EXISTS public.dropship_supplier_catalog (
  id                 BIGSERIAL       PRIMARY KEY,
  supplier           TEXT            NOT NULL,
  external_id        TEXT            NOT NULL,
  title              TEXT            NOT NULL,
  price_eur          NUMERIC(12, 2)  NOT NULL DEFAULT 0,
  image_url          TEXT,
  supplier_url       TEXT,
  is_dropship_direct BOOLEAN         NOT NULL DEFAULT false,
  raw                JSONB,
  synced_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE (supplier, external_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_direct
  ON public.dropship_supplier_catalog (supplier)
  WHERE is_dropship_direct = true;

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_title
  ON public.dropship_supplier_catalog
  USING gin (to_tsvector('simple', title));
