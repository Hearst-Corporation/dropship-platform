-- 032_dropship_suppliers.down.sql
-- Rollback: drop indexes and the table created by 032_dropship_suppliers.sql.

DROP INDEX IF EXISTS public.idx_dropship_suppliers_tier;
DROP INDEX IF EXISTS public.idx_dropship_suppliers_status;
DROP TABLE IF EXISTS public.dropship_suppliers;
