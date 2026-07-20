import { StoreShell } from '@/app/_components/StoreShell';
import type { FactoryStore } from '@/lib/storefront/factory-data';
import { buildStorefrontData } from '@/lib/storefront/template-data';
import { resolveStorefrontTemplateId } from '@/lib/storefront/resolve-template';
import { MonoPremiumTech } from '@/lib/storefront/templates/mono-premium-tech';
import { BeautyWellness } from '@/lib/storefront/templates/beauty-wellness';
import { PetHomePractical } from '@/lib/storefront/templates/pet-home-practical';

/**
 * Renders a factory store: StoreShell chrome + the resolved marketing
 * template composed from the store's landing_content and product. Pure —
 * takes already-loaded data (no Medusa). Used by both the public /shop route
 * and the admin preview route.
 */
export function StorefrontRenderer({ fs, preview = false }: { fs: FactoryStore; preview?: boolean }) {
  const data = buildStorefrontData(fs);
  const templateId = resolveStorefrontTemplateId(fs.store);

  return (
    <StoreShell store={fs.store}>
      {preview && (
        <div className="w-full bg-accent-600 px-4 py-2 text-center text-xs font-semibold text-white">
          Aperçu factory — {fs.store.status} · template {templateId} · non publié
        </div>
      )}
      {templateId === 'beauty-wellness-no-claims' ? (
        <BeautyWellness data={data} />
      ) : templateId === 'pet-home-practical' ? (
        <PetHomePractical data={data} />
      ) : (
        <MonoPremiumTech data={data} />
      )}
    </StoreShell>
  );
}
