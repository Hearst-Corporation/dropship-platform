-- 031_order_forward_supplier.down.sql
-- Rollback: remove the supplier columns + composite index, restore the
-- original single-column idempotency index from 005_order_forward_lock.sql.

DROP INDEX IF EXISTS idx_order_forwards_live_unique_supplier;
DROP INDEX IF EXISTS idx_order_forwards_supplier;

-- Restore the original lock index (medusa_order_id only).
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_forwards_live_unique
  ON public.dropship_order_forwards(medusa_order_id)
  WHERE dry_run = false AND status IN ('sending', 'sent');

ALTER TABLE public.dropship_order_forwards
  DROP COLUMN IF EXISTS supplier_order_id;

ALTER TABLE public.dropship_order_forwards
  DROP COLUMN IF EXISTS supplier;
