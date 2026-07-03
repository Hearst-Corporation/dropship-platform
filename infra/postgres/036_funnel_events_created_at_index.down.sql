-- 036_funnel_events_created_at_index.down.sql
-- Rollback: drop the dashboard-wide funnel_events indexes.

DROP INDEX IF EXISTS idx_funnel_events_created_at;
DROP INDEX IF EXISTS idx_funnel_events_purchase_created;
