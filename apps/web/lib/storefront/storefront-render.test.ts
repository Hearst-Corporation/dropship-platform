import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { buildStorefrontData } from './template-data';
import { resolveBlueprint } from './blueprint-templates';
import type { FactoryStore, FactoryProduct } from './factory-data';
import type { StoreConfig } from '@/lib/store-config';

/** Store factory GPU1 minimal (aucune donnée Medusa requise). */
function factoryStore(): FactoryStore {
  const product: FactoryProduct = {
    handle: 'ext-123',
    title: 'Lampe de bureau pliable',
    description: 'Une lampe compacte et orientable.',
    priceCents: 3990,
    costCents: 1200,
    imageUrl: 'https://pub-abc.r2.dev/store/run-1/product.jpg',
    supplier: 'aliexpress',
    supplierUrl: null,
  };
  const store = {
    id: 's1',
    slug: 'lumen',
    name: 'Lumen',
    niche: 'gadget tech',
    mode: 'mono',
    template: 'auto',
    heroImageUrl: 'https://pub-abc.r2.dev/store/run-1/hero.jpg',
    cutoutImageUrl: null,
    lifestyleImages: ['https://pub-abc.r2.dev/store/run-1/life-1.jpg'],
    landingContent: {
      hero: { kicker: 'Nouveau', headline_html: 'La lumière <em>juste</em>', lede: 'Compacte, orientable.' },
      selling_points: [{ title: 'Pliable', body: 'Se range partout.' }],
      specs: [{ key: 'Autonomie', value: '8 h' }],
      trust_promises: [{ title: 'Livraison', body: 'Sous 24 h' }],
      included_items: [{ qty: '1', label: 'Lampe + câble' }],
      final_cta: { kicker: 'Prêt ?', headline_html: 'Commandez la vôtre', lede: 'Stock limité.' },
    },
  } as unknown as StoreConfig;
  return { store, products: [product], hero: product };
}

describe('buildStorefrontData (GPU1, no Medusa)', () => {
  it('mappe le store + landing_content en props de blocs sans dépendance Medusa', () => {
    const data = buildStorefrontData(factoryStore());
    expect(data.hero.headlineHtml).toContain('<em>');
    expect(data.benefits).toHaveLength(1);
    expect(data.specs[0].key).toBe('Autonomie');
    expect(data.included[0].label).toContain('Lampe');
    expect(data.priceLabel).toMatch(/39/);
    expect(data.heroImageUrl).toContain('r2.dev');
    expect(data.finalCta.headline).toBe('Commandez la vôtre');
  });

  it('un store gadget résout vers gadget-impulse-premium et rend des blocs non vides', () => {
    const fsStore = factoryStore();
    const bp = resolveBlueprint(fsStore.store);
    expect(bp.id).toBe('gadget-impulse-premium');
    expect(bp.blockOrder.length).toBeGreaterThan(4);
  });
});

describe('render path never imports Medusa (FACTORY_LOCAL_ONLY safe)', () => {
  const renderPath = [
    'components/storefront/StorefrontRenderer.tsx',
    'components/storefront/BlueprintRenderer.tsx',
    'lib/storefront/blueprint-templates.ts',
    'lib/storefront/factory-data.ts',
    'lib/storefront/template-data.ts',
    'components/storefront/blocks/index.ts',
    'components/storefront/blocks/hero.tsx',
    'components/storefront/blocks/showcase.tsx',
    'components/storefront/blocks/transformation.tsx',
    'components/storefront/blocks/bundle.tsx',
    'components/storefront/blocks/reassurance.tsx',
    'components/storefront/blocks/sticky-cta.tsx',
  ];

  it('aucun fichier du chemin de rendu n’importe @/lib/medusa', async () => {
    for (const rel of renderPath) {
      const src = await fs.readFile(path.join(process.cwd(), rel), 'utf8');
      expect(src, rel).not.toMatch(/from ['"]@\/lib\/medusa/);
      expect(src, rel).not.toMatch(/lib\/medusa-store/);
    }
  });
});
