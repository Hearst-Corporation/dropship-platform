'use client'

import { useMemo, useState } from 'react'
import { ArrowTopRightOnSquareIcon, EyeIcon, ArrowPathIcon } from '@heroicons/react/16/solid'
import { CubeIcon } from '@heroicons/react/24/outline'
import type { MedusaProduct } from '@/lib/medusa'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/catalyst/table'
import { Badge } from '@/components/catalyst/badge'
import { AdminToolbar } from '@/components/admin/AdminToolbar'
import { AdminDataTable } from '@/components/admin/AdminDataTable'
import { AdminAssetCell } from '@/components/admin/AdminAssetCell'
import { AdminActionMenu } from '@/components/admin/AdminActionMenu'
import { AdminEmptyState } from '@/components/admin/AdminEmptyState'

/** Empty-value glyph for columns without a real data source. */
const DASH = '—'

const STATUS_LABELS: Record<MedusaProduct['status'], string> = {
  draft: 'Brouillon',
  proposed: 'Proposé',
  published: 'Publié',
  rejected: 'Rejeté',
}

const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'Publié', value: 'published' },
  { label: 'Brouillon', value: 'draft' },
  { label: 'Proposé', value: 'proposed' },
  { label: 'Rejeté', value: 'rejected' },
]

/**
 * Single-accent status color: only the "published" state carries the accent
 * hue (indigo); every other state is neutral zinc, disambiguated by its label.
 */
function statusBadgeColor(status: MedusaProduct['status']): 'indigo' | 'zinc' {
  return status === 'published' ? 'indigo' : 'zinc'
}

/** Cheapest real price across a product's variants, in minor units + currency. */
function minPrice(p: MedusaProduct): { amount: number; currency: string } | null {
  let best: { amount: number; currency: string } | null = null
  for (const v of p.variants ?? []) {
    for (const price of v.prices ?? []) {
      if (typeof price.amount !== 'number') continue
      if (!best || price.amount < best.amount) {
        best = { amount: price.amount, currency: price.currency_code }
      }
    }
  }
  return best
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount / 100)
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return dateFmt.format(d)
}

/**
 * Compact secondary line folded into the product cell: variant count, the
 * supplier reference when present, and the last-sync date. Secondary/placeholder
 * data lives here instead of in dead standalone columns.
 */
function buildDetails(p: MedusaProduct): string {
  const parts: string[] = []
  const variantCount = p.variants?.length ?? 0
  parts.push(`${variantCount} variante${variantCount > 1 ? 's' : ''}`)
  if (p.external_id) parts.push(`réf. ${p.external_id}`)
  const synced = formatDate(p.updated_at)
  if (synced) parts.push(`sync ${synced}`)
  return parts.join(' · ')
}

export function CatalogTable({ products }: { products: MedusaProduct[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (status !== 'all' && p.status !== status) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        (p.external_id ?? '').toLowerCase().includes(q)
      )
    })
  }, [products, query, status])

  const countLabel = `${filtered.length} sur ${products.length} produit${products.length > 1 ? 's' : ''}`

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AdminToolbar
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Rechercher un produit, handle ou réf. fournisseur…',
        }}
        filters={[
          {
            label: 'Statut',
            value: status,
            onChange: setStatus,
            options: STATUS_OPTIONS,
          },
        ]}
        count={countLabel}
      />

      {filtered.length === 0 ? (
        <AdminDataTable>
          <AdminEmptyState
            icon={CubeIcon}
            title="Aucun produit ne correspond"
            description="Ajuste la recherche ou le filtre de statut pour retrouver un SKU."
          />
        </AdminDataTable>
      ) : (
        <AdminDataTable minWidth="min-w-[40rem]">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Produit</TableHeader>
                <TableHeader className="text-right">Prix</TableHeader>
                <TableHeader>Statut</TableHeader>
                <TableHeader className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => {
                const price = minPrice(p)
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <AdminAssetCell
                        imageUrl={p.thumbnail}
                        title={p.title}
                        subtitle={buildDetails(p)}
                        handle={p.handle}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {price ? (
                        formatMoney(price.amount, price.currency)
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">{DASH}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge color={statusBadgeColor(p.status)}>{STATUS_LABELS[p.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <AdminActionMenu
                        ariaLabel={`Actions pour ${p.title}`}
                        actions={[
                          {
                            label: 'Ouvrir la fiche',
                            href: `/products/${p.handle}`,
                            icon: ArrowTopRightOnSquareIcon,
                          },
                          {
                            // No storefront preview route wired for a raw catalog product.
                            label: 'Aperçu',
                            icon: EyeIcon,
                            disabled: true,
                          },
                          {
                            // No manual re-sync endpoint exposed here.
                            label: 'Synchroniser',
                            icon: ArrowPathIcon,
                            disabled: true,
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </AdminDataTable>
      )}
    </div>
  )
}
