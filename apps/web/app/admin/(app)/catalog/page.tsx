import Link from 'next/link';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { medusa, type MedusaProduct } from '@/lib/medusa';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminBadge } from '@/components/admin/AdminBadge';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  let products: MedusaProduct[] = [];
  let error: string | null = null;
  try {
    const r = await medusa.getProducts({ limit: 50 });
    products = r.products;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur';
  }

  const published = products.filter((p) => p.status === 'published').length;
  const drafts = products.length - published;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <AdminPageHeader
        eyebrow="Production · Medusa"
        title="Catalogue Medusa"
        description="Tous les SKU publiés par l'agent. Source de vérité du stock e-commerce, indépendante des storefronts."
        actions={
          <span className="text-xs tabular-nums text-gray-500">
            {products.length} produit{products.length > 1 ? 's' : ''}
            {drafts > 0 ? ` · ${drafts} brouillon${drafts > 1 ? 's' : ''}` : ''}
            {published > 0 ? ` · ${published} publié${published > 1 ? 's' : ''}` : ''}
          </span>
        }
      />

      {error && (
        <div className="rounded-xl bg-rose-500/5 p-5 ring-1 ring-inset ring-rose-500/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Erreur Medusa</p>
          <p className="mt-1.5 text-sm text-gray-400">{error}</p>
        </div>
      )}

      {!error && products.length === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 bg-gray-800/50 px-6 py-16">
          <div className="text-center">
            <p className="text-sm font-semibold text-white">Aucun produit publié pour le moment.</p>
            <p className="mt-1 text-sm text-gray-500">Lance l&apos;agent pour publier les premiers SKU.</p>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-gray-800/50 ring-1 ring-inset ring-white/10">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="sticky top-0 z-10 bg-gray-800">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-white">
                  <th scope="col" className="w-16 py-3.5 pl-6 pr-3" />
                  <th scope="col" className="px-3 py-3.5">Produit</th>
                  <th scope="col" className="px-3 py-3.5">Handle</th>
                  <th scope="col" className="px-3 py-3.5">Statut</th>
                  <th scope="col" className="px-3 py-3.5">Variantes</th>
                  <th scope="col" className="py-3.5 pl-3 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5">
                    <td className="py-3 pl-6 pr-3">
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbnail}
                          alt=""
                          className="size-11 rounded-lg object-cover ring-1 ring-inset ring-white/10"
                        />
                      ) : (
                        <div className="size-11 rounded-lg bg-white/5 ring-1 ring-inset ring-white/10" />
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium text-white">{p.title}</td>
                    <td className="px-3 py-3">
                      <code className="font-mono text-xs text-gray-500">{p.handle}</code>
                    </td>
                    <td className="px-3 py-3">
                      <AdminBadge color={p.status === 'published' ? 'green' : 'zinc'}>
                        {p.status}
                      </AdminBadge>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-gray-400">{p.variants?.length ?? 0}</td>
                    <td className="py-3 pl-3 pr-6 text-right">
                      <Link
                        href={`/products/${p.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                      >
                        Ouvrir
                        <ArrowTopRightOnSquareIcon aria-hidden className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
