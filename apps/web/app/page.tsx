import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listProducts, storefrontEnabled, type StoreProduct } from '@/lib/medusa-store';
import { StoreShell } from './_components/StoreShell';
import { ProductCard } from './_components/ProductCard';

// Hearst Dropship runs as a portfolio of per-store storefronts at /shop/{slug}
// (or each store's own custom domain). The root path is reserved for the
// admin: visiting `/` lands operators on the portfolio dashboard.
//
// Real visitors only ever see /shop/<slug> URLs (or their store's custom
// domain rewritten transparently by the middleware), so this redirect is
// invisible to end customers.
export default function RootPage() {
  redirect('/admin');
}

function Hero() {
  return (
    <section className="border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Objets choisis, livrés en Europe.</h1>
        <p className="mt-4 text-zinc-600 max-w-2xl mx-auto">
          Une sélection minimaliste de pièces design, sourcées et expédiées sans friction.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-md hover:bg-zinc-800"
        >
          Voir la sélection
        </Link>
      </div>
    </section>
  );
}

