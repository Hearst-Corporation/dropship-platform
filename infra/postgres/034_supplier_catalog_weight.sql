-- 034_supplier_catalog_weight.sql
-- Add the weight_grams column expected by the feed-only supplier clients
-- (wholesale2b.ts, inventory-source.ts) which SELECT and UPSERT it. Migration
-- 033 created dropship_supplier_catalog without it, causing runtime
-- "column weight_grams does not exist" errors during store creation.
-- Idempotent: safe to run multiple times. Apply after 033.

ALTER TABLE public.dropship_supplier_catalog
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER;
