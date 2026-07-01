-- 031_order_forward_supplier.sql
-- Generalize dropship_order_forwards beyond AliExpress. Additive + idempotent.

ALTER TABLE public.dropship_order_forwards
  ADD COLUMN IF NOT EXISTS supplier TEXT NOT NULL DEFAULT 'aliexpress';

ALTER TABLE public.dropship_order_forwards
  ADD COLUMN IF NOT EXISTS supplier_order_id TEXT;

-- Back-fill the generic column from the AE-specific one for all existing rows.
UPDATE public.dropship_order_forwards
   SET supplier_order_id = ae_order_id
 WHERE supplier_order_id IS NULL AND ae_order_id IS NOT NULL;

-- Index for filtering/grouping by supplier.
CREATE INDEX IF NOT EXISTS idx_order_forwards_supplier
  ON public.dropship_order_forwards(supplier);

COMMENT ON COLUMN public.dropship_order_forwards.supplier IS
  'Supplier that fulfilled this forward (registry id). Default aliexpress for pre-031 rows.';

COMMENT ON COLUMN public.dropship_order_forwards.supplier_order_id IS
  'Provider-neutral fulfillment order id. Mirrors ae_order_id for aliexpress rows.';

-- Replace the single-column unique lock with a composite one so a split-supplier
-- cart can forward one leg per supplier without conflicting.
-- Original index (from 005_order_forward_lock.sql):
--   UNIQUE ON (medusa_order_id) WHERE dry_run = false AND status IN ('sending', 'sent')
DROP INDEX IF EXISTS idx_order_forwards_live_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_forwards_live_unique_supplier
  ON public.dropship_order_forwards(medusa_order_id, supplier)
  WHERE dry_run = false AND status IN ('sending', 'sent');
