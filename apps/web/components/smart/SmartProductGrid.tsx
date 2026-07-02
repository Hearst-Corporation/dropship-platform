import type { StoreConfig } from '@/lib/store-config';
import type { StoreProduct } from '@/lib/medusa-store';
import { SmartProductCard } from './SmartProductCard';
import { dsClass } from '@/lib/design/css-vars';

interface SmartProductGridProps {
  store: StoreConfig;
  products: StoreProduct[];
  title?: string;
}

export function SmartProductGrid({ store, products, title }: SmartProductGridProps) {
  if (products.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className={`py-20 text-center ${dsClass.textMuted}`}>Aucun produit disponible pour le moment.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {title && (
        <h2 className={`mb-8 text-2xl font-bold ${dsClass.text}`} style={{ fontFamily: 'var(--ds-font-display)' }}>
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <SmartProductCard key={product.id} store={store} product={product} slug={store.slug} />
        ))}
      </div>
    </section>
  );
}
