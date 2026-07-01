-- 033_supplier_catalog.down.sql
-- Rollback: drop indexes and table created by 033_supplier_catalog.sql.

DROP INDEX IF EXISTS public.idx_supplier_catalog_title;
DROP INDEX IF EXISTS public.idx_supplier_catalog_direct;
DROP TABLE IF EXISTS public.dropship_supplier_catalog;
