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
import { AdminToolbar } from '@/components/admin/AdminToolbar'
import { AdminDataTable } from '@/components/admin/AdminDataTable'
import { AdminAssetCell } from '@/components/admin/AdminAssetCell'
import { AdminBadge } from '@/components/admin/AdminBadge'
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

/** Sum of per-variant inventory_quantity (real field; often 0 since manage_inventory=false). */
function totalInventory(p: MedusaProduct): number {
  return (p.variants ?? []).reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0)
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(iso?: string): string {
  if (!iso) return DASH
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return DASH
  return dateFmt.format(d)
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
        <AdminDataTable minWidth="min-w-[64rem]">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Produit</TableHeader>
                <TableHeader>Store</TableHeader>
                <TableHeader>Fournisseur</TableHeader>
                <TableHeader className="text-right">Prix</TableHeader>
                <TableHeader className="text-right">Coût</TableHeader>
                <TableHeader className="text-right">Marge</TableHeader>
                <TableHeader className="text-right">Inventaire</TableHeader>
                <TableHeader className="text-right">Variantes</TableHeader>
                <TableHeader>Statut</TableHeader>
                <TableHeader>Dernier sync</TableHeader>
                <TableHeader className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => {
                const price = minPrice(p)
                const inventory = totalInventory(p)
                const variantCount = p.variants?.length ?? 0
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <AdminAssetCell
                        imageUrl={p.thumbnail}
                        title={p.title}
                        subtitle={p.subtitle || p.categories?.[0]?.name || undefined}
                        handle={p.handle}
                      />
                    </TableCell>
                    {/* Store: no sales-channel attribution on MedusaProduct here. */}
                    <TableCell className="text-zinc-400 dark:text-zinc-500">{DASH}</TableCell>
                    <TableCell>
                      {p.external_id ? (
                        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {p.external_id}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">{DASH}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {price ? (
                        formatMoney(price.amount, price.currency)
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">{DASH}</span>
                      )}
                    </TableCell>
                    {/* Coût: no cost/COGS field on MedusaProduct. */}
                    <TableCell className="text-right tabular-nums text-zinc-400 dark:text-zinc-500">
                      {DASH}
                    </TableCell>
                    {/* Marge: requires cost, not available. */}
                    <TableCell className="text-right tabular-nums text-zinc-400 dark:text-zinc-500">
                      {DASH}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {inventory > 0 ? (
                        inventory
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">{DASH}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{variantCount}</TableCell>
                    <TableCell>
                      <AdminBadge status={p.status}>{STATUS_LABELS[p.status]}</AdminBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {formatDate(p.updated_at)}
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
