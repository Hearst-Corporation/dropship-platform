import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { medusa, type MedusaProduct } from '@/lib/medusa';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text, Strong, Code } from '@/components/catalyst/text';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { Button } from '@/components/catalyst/button';
import {
  Pagination,
  PaginationGap,
  PaginationList,
  PaginationNext,
  PaginationPage,
  PaginationPrevious,
} from '@/components/catalyst/pagination'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminEmptyState } from '@/components/admin/AdminEmptyState'
import { CatalogTable } from './CatalogTable'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

/**
 * Page numbers to render in the pagination strip: first and last always
 * visible, a one-page window around the current page, gaps elsewhere.
 */
function pageItems(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>([1, total])
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const items: Array<number | 'gap'> = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev === 2) items.push(prev + 1)
    else if (p - prev > 2) items.push('gap')
    items.push(p)
    prev = p
  }
  return items
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: rawPage } = await searchParams
  const parsedPage = Number.parseInt(rawPage ?? '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  let products: MedusaProduct[] = []
  let count = 0
  let error: string | null = null
  try {
    const r = await medusa.getProducts({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
    products = r.products
    count = r.count
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur'
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
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
              {count} produit{count > 1 ? 's' : ''}
            </span>
            {totalPages > 1 ? (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  page {page} sur {totalPages}
                </span>
              </>
            ) : (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {published} publié{published > 1 ? 's' : ''}
                </span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {drafts} brouillon{drafts > 1 ? 's' : ''}
                </span>
              </>
            )}
          </>
        }
      />

      {error && (
        <div>
          <Subheading level={2}>
            <AdminBadge status="error">Erreur Medusa</AdminBadge>
          </Subheading>
          <Text className="mt-2">{error}</Text>
          <div className="mt-4">
            <Button outline href="/admin/catalog">
              Réessayer
            </Button>
          </div>
        </div>
      ) : count === 0 ? (
        <div className="rounded-xl border border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-900">
          <AdminEmptyState
            icon={CubeIcon}
            title="Aucun produit publié pour le moment"
            description="Lance l'agent pour publier les premiers SKU dans le catalogue Medusa."
            action={<Button href="/admin/stores/new">Créer une boutique</Button>}
          />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-900">
          <AdminEmptyState
            icon={CubeIcon}
            title="Cette page est vide"
            description="Le catalogue compte moins de pages que demandé."
            action={
              <Button outline href="/admin/catalog">
                Revenir à la première page
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <CatalogTable products={products} />
          {totalPages > 1 ? (
            <Pagination className="mt-6" aria-label="Pagination du catalogue">
              <PaginationPrevious href={page > 1 ? `?page=${page - 1}` : null}>
                Précédent
              </PaginationPrevious>
              <PaginationList>
                {pageItems(page, totalPages).map((item, index) =>
                  item === 'gap' ? (
                    <PaginationGap key={`gap-${index}`} />
                  ) : (
                    <div className="size-11 rounded-lg bg-zinc-950/5 ring-1 ring-inset ring-zinc-950/10 dark:bg-white/5 dark:ring-white/10" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell>
                  <Code>{p.handle}</Code>
                </TableCell>
                <TableCell>
                  <AdminBadge status={p.status}>{p.status}</AdminBadge>
                </TableCell>
                <TableCell className="tabular-nums">{p.variants?.length ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Button plain href={`/products/${p.handle}`} target="_blank" rel="noreferrer">
                    Ouvrir
                    <ArrowTopRightOnSquareIcon aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
