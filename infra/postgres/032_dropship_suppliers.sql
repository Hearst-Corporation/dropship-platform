-- 032_dropship_suppliers.sql
-- Admin read-model for the supplier registry.
-- This table is a DISPLAY MIRROR only — the source of truth for which
-- suppliers are active and what their capabilities are is policy.ts + the
-- SupplierClient implementations in apps/web/lib/suppliers/.
-- The table is populated/synced by an admin endpoint or cron; enforcement
-- never reads from here at runtime.
-- Idempotent (re-runnable).

CREATE TABLE IF NOT EXISTS public.dropship_suppliers (
  id                  TEXT        NOT NULL,
  label               TEXT        NOT NULL,
  tier                TEXT        NOT NULL CHECK (tier IN ('v1', 'v2')),
  status              TEXT        NOT NULL DEFAULT 'inactive'
                                  CHECK (status IN ('active', 'inactive', 'search_only', 'feed-only', 'automation', 'excluded')),
  capabilities        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  exclusion_reason    TEXT,
  exclusion_note      TEXT,
  connection_state    TEXT        NOT NULL DEFAULT 'unknown'
                                  CHECK (connection_state IN ('unknown', 'connected', 'error', 'missing-key')),
  last_checked_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dropship_suppliers_pkey PRIMARY KEY (id)
);

-- Index: filter by active/inactive status for the admin dashboard list
CREATE INDEX IF NOT EXISTS idx_dropship_suppliers_status
  ON public.dropship_suppliers (status);

-- Index: filter by tier (v1 legacy vs v2 full-api)
CREATE INDEX IF NOT EXISTS idx_dropship_suppliers_tier
  ON public.dropship_suppliers (tier);

COMMENT ON TABLE public.dropship_suppliers IS
  'Display mirror of the supplier registry. Enforcement stays in policy.ts '
  'and SupplierClient implementations — do not gate runtime logic on this table.';

COMMENT ON COLUMN public.dropship_suppliers.id IS
  'Registry id — must match SupplierClient.id (e.g. ''aliexpress'', ''bigbuy'').';

COMMENT ON COLUMN public.dropship_suppliers.status IS
  'Mirrors SupplierClient.status. ''inactive'' = known but not yet wired. '
  'Enforcement is in code, not in this column.';

COMMENT ON COLUMN public.dropship_suppliers.capabilities IS
  'JSON snapshot of SupplierCapabilities (8 boolean keys). Denormalized for '
  'dashboard display; canonical values are in the TypeScript client files.';

COMMENT ON COLUMN public.dropship_suppliers.connection_state IS
  'Last known auth/connectivity check result. Updated by admin health-check '
  'endpoint. Does not gate any runtime path.';

COMMENT ON COLUMN public.dropship_suppliers.exclusion_reason IS
  'Mirrors ExclusionReason from policy.ts (moq|wholesale|manual-sourcing|no-fulfillment). '
  'Null for non-excluded suppliers.';
