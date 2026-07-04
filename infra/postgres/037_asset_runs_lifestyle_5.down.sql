-- 037_asset_runs_lifestyle_5.down.sql
-- Revert dropship_asset_runs.asset_kind CHECK to lifestyle-1..3.
-- NOTE: will fail if any row already has asset_kind = 'lifestyle-4'/'lifestyle-5' —
-- clean those up (or re-map them) before rolling back.

ALTER TABLE dropship_asset_runs DROP CONSTRAINT IF EXISTS dropship_asset_runs_asset_kind_check;

ALTER TABLE dropship_asset_runs
  ADD CONSTRAINT dropship_asset_runs_asset_kind_check
  CHECK (asset_kind IN ('hero','cutout','lifestyle-1','lifestyle-2','lifestyle-3','promo','all'));
