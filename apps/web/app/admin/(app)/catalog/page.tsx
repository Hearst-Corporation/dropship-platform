import { ArrowDownTrayIcon } from '@heroicons/react/16/solid'
import { CubeIcon } from '@heroicons/react/24/outline'
import { medusa, type MedusaProduct } from '@/lib/medusa'
import { Subheading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminEmptyState } from '@/components/admin/AdminEmptyState'
import { CatalogTable } from './CatalogTable'

export const dynamic = 'force-dynamic'

export default async function CatalogPage() {
  let products: MedusaProduct[] = []
  let error: string | null = null
  try {
    const r = await medusa.getProducts({ limit: 50 })
    products = r.products
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur'
  }

  const published = products.filter((p) => p.status === 'published').length
  const drafts = products.length - published

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminPageHeader
        title="Catalogue Medusa"
        subtitle="Tous les SKU publiés par l'agent. Source de vérité du stock e-commerce, indépendante des storefronts."
        meta={
          <>
            <span className="tabular-nums">
              {products.length} produit{products.length > 1 ? 's' : ''}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{published} publié{published > 1 ? 's' : ''}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{drafts} brouillon{drafts > 1 ? 's' : ''}</span>
          </>
        }
        actions={
          <Button outline disabled title="Export non disponible">
            <ArrowDownTrayIcon aria-hidden />
            Exporter
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-zinc-950/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
          <Subheading level={2}>
            <Badge color="zinc">Erreur Medusa</Badge>
          </Subheading>
          <Text className="mt-2">{error}</Text>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-900">
          <AdminEmptyState
            icon={CubeIcon}
            title="Aucun produit publié pour le moment"
            description="Lance l'agent pour publier les premiers SKU dans le catalogue Medusa."
          />
        </div>
      ) : (
        <CatalogTable products={products} />
      )}
    </div>
  )
}
