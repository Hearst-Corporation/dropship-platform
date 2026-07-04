-- 037_asset_runs_lifestyle_5.sql
-- Widen dropship_asset_runs.asset_kind CHECK to allow lifestyle-4 / lifestyle-5.
--
-- The mono asset pipeline now accepts an operator-configurable
-- `lifestyleImageCount` (1-5, default 3) instead of a hardcoded 3. The
-- original CHECK from 019_asset_runs.sql only allowed lifestyle-1..3, which
-- would reject inserts for slots 4/5 with a constraint violation. Re-runnable:
-- drops and recreates the same-named constraint idempotently.

ALTER TABLE dropship_asset_runs DROP CONSTRAINT IF EXISTS dropship_asset_runs_asset_kind_check;

ALTER TABLE dropship_asset_runs
  ADD CONSTRAINT dropship_asset_runs_asset_kind_check
  CHECK (asset_kind IN ('hero','cutout','lifestyle-1','lifestyle-2','lifestyle-3','lifestyle-4','lifestyle-5','promo','all'));
