-- 034_supplier_catalog_weight.down.sql
-- Rollback: drop the weight_grams column added by 034.

ALTER TABLE public.dropship_supplier_catalog
  DROP COLUMN IF EXISTS weight_grams;
