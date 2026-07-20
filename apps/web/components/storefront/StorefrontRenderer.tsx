import { StoreShell } from '@/app/_components/StoreShell';
import type { FactoryStore } from '@/lib/storefront/factory-data';
import { buildStorefrontData } from '@/lib/storefront/template-data';
import { resolveBlueprint, getBlueprint } from '@/lib/storefront/blueprint-templates';
import { BlueprintRenderer } from '@/components/storefront/BlueprintRenderer';

/**
 * Renders a factory store: StoreShell chrome + the resolved marketing template.
 * The template is a TemplateBlueprint (data) composed by BlueprintRenderer from
 * the store's landing_content + products. Pure — takes already-loaded data (no
 * Medusa). Used by both the public /shop route and the admin preview route.
 *
 * `blueprintOverrideId` is admin-only (the preview route passes `?template=`):
 * it previews ANY blueprint against this store's data without mutating anything.
 * The public /shop route never sets it, so live stores always use the resolver.
 */
export function StorefrontRenderer({
  fs,
  preview = false,
  blueprintOverrideId,
}: {
  fs: FactoryStore;
  preview?: boolean;
  blueprintOverrideId?: string;
}) {
  const data = buildStorefrontData(fs);
  const override = blueprintOverrideId ? getBlueprint(blueprintOverrideId) : undefined;
  const blueprint = override ?? resolveBlueprint(fs.store);

  return (
    <StoreShell store={fs.store}>
      {preview && (
        <div className="w-full bg-accent-600 px-4 py-2 text-center text-xs font-semibold text-white">
          Aperçu factory — {fs.store.status} · template {blueprint.id}
          {override ? ' (forcé)' : ''} · non publié
        </div>
      )}
      <BlueprintRenderer blueprint={blueprint} data={data} />
    </StoreShell>
  );
}
