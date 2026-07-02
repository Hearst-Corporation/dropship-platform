import Link from 'next/link';
import type { StoreConfig } from '@/lib/store-config';
import type { StoreProduct } from '@/lib/medusa-store';
import { formatMoney } from '@/lib/medusa-store';
import { DS } from '@/lib/design/css-vars';

interface SmartCartUpsellProps {
  store: StoreConfig;
  currentProduct: StoreProduct;
  products: StoreProduct[];
}

export function SmartCartUpsell({ store, currentProduct, products }: SmartCartUpsellProps) {
  const upsells = products.filter((p) => p.id !== currentProduct.id).slice(0, 3);
  if (upsells.length === 0) return null;

  return (
    <section className="border-t py-8" style={{ borderColor: DS.border }}>
      <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--ds-text)' }}>
        Vous pourriez aussi aimer
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {upsells.map((product) => {
          const variant = product.variants?.[0];
          const price = variant?.calculated_price?.calculated_amount;
          const currency = variant?.calculated_price?.currency_code || 'eur';
          const imageUrl = product.thumbnail || product.images?.[0]?.url;
          return (
            <Link
              key={product.id}
              href={`/shop/${store.slug}/products/${product.handle}`}
              className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-[var(--ds-surface)]"
              style={{ borderColor: DS.border }}
            >
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={product.title} className="size-16 rounded-md object-cover" />
              )}
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ds-text)' }}>{product.title}</p>
                {price !== undefined && (
                  <p className="text-sm font-semibold" style={{ color: DS.accent }}>
                    {formatMoney(price, currency)}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
