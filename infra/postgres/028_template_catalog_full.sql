-- 028_template_catalog_full.sql
-- Align the dropship_stores.template CHECK constraint with the full
-- TEMPLATE_CATALOG in apps/web/lib/template-catalog.ts (27 ids).
--
-- Migration 027 only listed 8 templates; the catalog grew to 27 entries
-- (wellness-*, events-*, Wix ports, etc.) while the DB constraint lagged.
--
-- Idempotent: drops the old constraint before recreating.

ALTER TABLE dropship_stores
  DROP CONSTRAINT IF EXISTS dropship_stores_template_check;

ALTER TABLE dropship_stores
  ADD CONSTRAINT dropship_stores_template_check
  CHECK (template IN (
    'auto',
    'mono',
    'collection-grid',
    'collection-editorial',
    'luxury-minimal',
    'gen-z-bold',
    'editorial-fashion',
    'wellness-soft',
    'luxury-mono',
    'wellness-serenity',
    'wellness-pulse',
    'wellness-dance',
    'wellness-studio',
    'wellness-retreat',
    'wellness-fitness-blog',
    'wellness-massage-quiet',
    'wellness-onyx-gym',
    'events-musicart',
    'events-bouquet',
    'events-arcadium',
    'events-summit',
    'events-converge',
    'fashion-boutique-1622',
    'beauty-salon-2851',
    'fiora-locks-wh1270',
    'adventure-travel-2787'
  ));
