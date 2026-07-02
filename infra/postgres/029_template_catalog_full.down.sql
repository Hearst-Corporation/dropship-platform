-- 029_template_catalog_full.down.sql
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
    'wellness-soft'
  ));
