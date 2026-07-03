-- 036_funnel_events_created_at_index.sql
-- Fix the portfolio dashboard's full-scan of dropship_funnel_events.
--
-- apps/web/app/admin/(app)/page.tsx runs several dashboard-wide queries
-- (revenue, funnel, 14-day trend) that aggregate across ALL stores, so they
-- have NO store_slug predicate — only a created_at range plus event_name
-- filters. Every existing index on dropship_funnel_events (008_store_analytics.sql)
-- is composite and store_slug-LEADING (e.g. (store_slug, created_at DESC)),
-- which Postgres cannot use for a query with no store_slug filter at all. As
-- the table grows across the whole platform, these queries degrade into a
-- sequential scan of the entire table regardless of the 7/14/30-day window
-- actually requested.
--
-- Two targeted indexes, matched to the two distinct query shapes:
--
--   1. idx_funnel_events_purchase_created — partial index on (created_at DESC)
--      WHERE event_name = 'purchase'. Covers the `revenue` query, which only
--      ever filters `event_name = 'purchase'` (SUM/COUNT/AVG(value_minor)
--      FILTER (WHERE event_name = 'purchase' AND created_at > ...) across the
--      7/30/60-day windows).
--
--   2. idx_funnel_events_created_at — non-partial (created_at DESC, event_name).
--      Covers the `funnel` query, which FILTERs on four distinct event_name
--      values (view_content, add_to_cart, initiate_checkout, purchase) over a
--      60-day range, and the 14-day `trend` query, which scans WHERE
--      created_at > now() - interval '14 days' with no event_name predicate
--      at all (event_name only appears inside a FILTER on the aggregates) —
--      both need a created_at-leading index, and trailing event_name lets
--      Postgres satisfy the event_name FILTERs as an index-only scan.
--
-- Idempotent: safe to re-run manually against Railway (no runner tracks
-- migration state in this repo). No CONCURRENTLY — no other migration in
-- this repo uses it, and these are plain single-statement CREATE INDEX runs.

CREATE INDEX IF NOT EXISTS idx_funnel_events_purchase_created
  ON public.dropship_funnel_events (created_at DESC)
  WHERE event_name = 'purchase';

CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at
  ON public.dropship_funnel_events (created_at DESC, event_name);

COMMENT ON INDEX idx_funnel_events_purchase_created IS
  'Speeds up dashboard-wide revenue aggregation (no store_slug filter) — see apps/web/app/admin/(app)/page.tsx revenue query.';
COMMENT ON INDEX idx_funnel_events_created_at IS
  'Speeds up dashboard-wide funnel + 14-day trend aggregation (no store_slug filter) — see apps/web/app/admin/(app)/page.tsx funnel/trend queries.';
