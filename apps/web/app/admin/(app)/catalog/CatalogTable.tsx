'use client'

import { useMemo, useState } from 'react'
import { ArrowTopRightOnSquareIcon, EllipsisHorizontalIcon } from '@heroicons/react/16/solid'
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
import { Button } from '@/components/catalyst/button'
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/catalyst/dropdown'
import { AdminBadge } from '@/components/admin/AdminBadge'
import { AdminToolbar } from '@/components/admin/AdminToolbar'
import { AdminDataTable } from '@/components/admin/AdminDataTable'
import { AdminAssetCell } from '@/components/admin/AdminAssetCell'
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
 * Cheapest real price across a product's variants, in minor units + currency.
 * `multiple` is true when the variants span several distinct amounts, so the
 * UI can prefix the minimum with "dès" instead of passing it off as THE price.
 */
function minPrice(p: MedusaProduct): { amount: number; currency: string; multiple: boolean } | null {
  let best: { amount: number; currency: string } | null = null
  let max = Number.NEGATIVE_INFINITY
  for (const v of p.variants ?? []) {
    for (const price of v.prices ?? []) {
      if (typeof price.amount !== 'number') continue
      if (!best || price.amount < best.amount) {
        best = { amount: price.amount, currency: price.currency_code }
      }
      if (price.amount > max) max = price.amount
    }
  }
  if (!best) return null
  return { ...best, multiple: max > best.amount }
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
            action={
              <Button
                outline
                onClick={() => {
                  setQuery('')
                  setStatus('all')
                }}
              >
                Réinitialiser les filtres
              </Button>
            }
          />
        </AdminDataTable>
      ) : (
        <AdminDataTable>
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Produit</TableHeader>
                <TableHeader className="text-right">Prix</TableHeader>
                <TableHeader className="hidden sm:table-cell">Statut</TableHeader>
                <TableHeader className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => {
                const price = minPrice(p)
                return (
                  <TableRow key={p.id} className="hover:bg-zinc-950/2.5 dark:hover:bg-white/2.5">
                    {/*
                      w-full on the td gives the flexible space to the product
                      column; the max-w on the inner cell (not on the td, which
                      would be ignored in auto table layout) caps its intrinsic
                      width so long AliExpress titles truncate instead of
                      forcing horizontal scroll.
                    */}
                    <TableCell className="w-full">
                      <AdminAssetCell
                        className="w-full max-w-lg"
                        imageUrl={p.thumbnail}
                        title={p.title}
                        subtitle={buildDetails(p)}
                        handle={p.handle}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {price ? (
                        <>
                          {price.multiple ? (
                            <span className="text-zinc-500 dark:text-zinc-400">dès </span>
                          ) : null}
                          {formatMoney(price.amount, price.currency)}
                        </>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">{DASH}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <AdminBadge status={p.status}>{STATUS_LABELS[p.status]}</AdminBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      {/*
                        Catalyst Dropdown used directly (kebab pattern):
                        AdminActionMenu doesn't forward `target`, and the
                        storefront product page must open in a new tab so the
                        admin keeps their context.
                      */}
                      <Dropdown>
                        <DropdownButton plain aria-label={`Actions pour ${p.title}`}>
                          <EllipsisHorizontalIcon data-slot="icon" />
                        </DropdownButton>
                        <DropdownMenu anchor="bottom end">
                          <DropdownItem href={`/products/${p.handle}`} target="_blank">
                            <ArrowTopRightOnSquareIcon data-slot="icon" />
                            <DropdownLabel>Ouvrir la fiche</DropdownLabel>
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
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
