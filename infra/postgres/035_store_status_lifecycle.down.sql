-- 035_store_status_lifecycle.down.sql
-- Rollback: restore the loose status column and remove diagnostic fields.
--
-- Statuses are mapped back to the closest old value:
--   'draft' -> 'creating'
--   'generating' -> 'creating'
--   'validating' -> 'creating'
--   'needs_repair' -> 'error'
--   'failed' -> 'error'
--   'ready' -> 'active'
--   'published' -> 'active'

ALTER TABLE dropship_stores
  DROP CONSTRAINT IF EXISTS dropship_stores_status_check;

UPDATE dropship_stores
SET status = CASE status
  WHEN 'draft' THEN 'creating'
  WHEN 'generating' THEN 'creating'
  WHEN 'validating' THEN 'creating'
  WHEN 'needs_repair' THEN 'error'
  WHEN 'failed' THEN 'error'
  WHEN 'ready' THEN 'active'
  WHEN 'published' THEN 'active'
  ELSE status
END
WHERE status IN ('draft', 'generating', 'validating', 'needs_repair', 'failed', 'ready', 'published');

ALTER TABLE dropship_stores
  DROP COLUMN IF EXISTS run_id,
  DROP COLUMN IF EXISTS error_phase,
  DROP COLUMN IF EXISTS error_path,
  DROP COLUMN IF EXISTS error_expected,
  DROP COLUMN IF EXISTS error_received,
  DROP COLUMN IF EXISTS error_raw_excerpt,
  DROP COLUMN IF EXISTS readiness_score,
  DROP COLUMN IF EXISTS published_at;

DROP INDEX IF EXISTS idx_dropship_stores_status_published;
