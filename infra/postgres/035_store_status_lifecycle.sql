-- 035_store_status_lifecycle.sql
-- Store generation lifecycle + diagnostic fields.
--
-- Replaces the loose TEXT status column with a real state machine:
--   draft -> generating -> validating -> ready -> published
--   draft -> generating -> needs_repair
--   any -> failed
--
-- Existing rows are migrated:
--   'creating' -> 'generating'
--   'active'   -> 'published'
--   'error'    -> 'failed'
--   'ready'    -> 'ready' (operator must publish explicitly)
--   'needs_repair' -> 'needs_repair'
--
-- Diagnostic columns are added so the admin can show phase, schema path,
-- expected/received values, raw LLM excerpt, readiness score, and published_at.
-- Idempotent: safe to re-run manually against Railway.

ALTER TABLE dropship_stores
  ADD COLUMN IF NOT EXISTS run_id text,
  ADD COLUMN IF NOT EXISTS error_phase text,
  ADD COLUMN IF NOT EXISTS error_path text,
  ADD COLUMN IF NOT EXISTS error_expected text,
  ADD COLUMN IF NOT EXISTS error_received text,
  ADD COLUMN IF NOT EXISTS error_raw_excerpt text,
  ADD COLUMN IF NOT EXISTS readiness_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Migrate old statuses before adding the CHECK constraint.
UPDATE dropship_stores
SET status = CASE status
  WHEN 'creating' THEN 'generating'
  WHEN 'active' THEN 'published'
  WHEN 'error' THEN 'failed'
  ELSE status
END
WHERE status IN ('creating', 'active', 'error');

-- Backfill published_at for rows that were already active/public.
UPDATE dropship_stores
SET published_at = COALESCE(published_at, updated_at, created_at)
WHERE status = 'published' AND published_at IS NULL;

-- Drop any previous CHECK constraint and recreate with the full lifecycle.
ALTER TABLE dropship_stores
  DROP CONSTRAINT IF EXISTS dropship_stores_status_check;

ALTER TABLE dropship_stores
  ADD CONSTRAINT dropship_stores_status_check
  CHECK (status IN ('draft', 'generating', 'validating', 'needs_repair', 'failed', 'ready', 'published'));

-- Index for the admin filters on the new statuses.
CREATE INDEX IF NOT EXISTS idx_dropship_stores_status_published
  ON dropship_stores(status)
  WHERE status IN ('ready', 'published', 'generating', 'needs_repair', 'failed');

COMMENT ON COLUMN dropship_stores.status IS
  'Store lifecycle: draft -> generating -> validating -> ready -> published, or needs_repair / failed.';
COMMENT ON COLUMN dropship_stores.run_id IS
  'Run identifier for the last generation attempt (links to dropship_ai_runs or admin diagnostic).';
COMMENT ON COLUMN dropship_stores.error_phase IS
  'Pipeline phase where the last failure happened (e.g. generate-products, enrich-products).';
COMMENT ON COLUMN dropship_stores.error_path IS
  'Schema path that failed validation, when applicable.';
COMMENT ON COLUMN dropship_stores.error_expected IS
  'Expected value/type at the failing schema path.';
COMMENT ON COLUMN dropship_stores.error_received IS
  'Received value/type at the failing schema path.';
COMMENT ON COLUMN dropship_stores.error_raw_excerpt IS
  'Head of the raw LLM response that caused the failure (truncated for safety).';
COMMENT ON COLUMN dropship_stores.readiness_score IS
  'Last computed readiness score (0-100).';
COMMENT ON COLUMN dropship_stores.published_at IS
  'Timestamp when the store was explicitly published.';
