import Link from 'next/link';
import type { StoreConfig } from '@/lib/store-config';
import type { StoreProduct } from '@/lib/medusa-store';
import { formatMoney } from '@/lib/medusa-store';
import { StoreLogo } from '@/components/ui';
import { DS, dsClass } from '@/lib/design/css-vars';

interface SmartProductCardProps {
  store: StoreConfig;
  product: StoreProduct;
  slug: string;
}

export function SmartProductCard({ store, product, slug }: SmartProductCardProps) {
  const variant = product.variants?.[0];
  const price = variant?.calculated_price?.calculated_amount;
  const currency = variant?.calculated_price?.currency_code || 'eur';
  const imageUrl = product.thumbnail || product.images?.[0]?.url;

  return (
    <Link
      href={`/shop/${slug}/products/${product.handle}`}
      className={`group overflow-hidden rounded-xl border shadow-xs transition-shadow hover:shadow-md ${dsClass.border} ${dsClass.surface}`}
    >
      <div className={`aspect-square overflow-hidden ${dsClass.bg}`}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${dsClass.textMuted}`}>
            <StoreLogo emoji={store.logoEmoji} size={40} strokeWidth={1.25} />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className={`mb-2 line-clamp-2 text-sm font-semibold ${dsClass.text}`}>{product.title}</h3>
        {price !== undefined && (
          <div className="text-lg font-bold" style={{ color: DS.accent }}>
            {formatMoney(price, currency)}
          </div>
        )}
        <div
          className="mt-3 w-full rounded-lg py-2 text-center text-sm font-medium text-white transition-opacity group-hover:opacity-90"
          style={{ backgroundColor: DS.primary }}
        >
          Voir le produit
        </div>
      </div>
    </Link>
  );
}
