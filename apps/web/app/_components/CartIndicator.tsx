import Link from 'next/link';
import { loadCart } from '@/lib/store-cart';

export async function CartIndicator() {
  const cart = await loadCart();
  const count = cart?.items?.reduce((acc, i) => acc + i.quantity, 0) ?? 0;
  return (
    <Link href="/cart" className="relative inline-flex items-center gap-1 hover:underline">
      <span>Panier</span>
      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs bg-zinc-900 text-white rounded-full">
        {count}
      </span>
    </Link>
  );
}
