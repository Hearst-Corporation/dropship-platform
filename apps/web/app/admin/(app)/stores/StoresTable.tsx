'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import { StoreAvatar } from '@/components/ui';
import { Button } from '@/components/catalyst/button';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/catalyst/table';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { StoreActions } from './StoreActions';

export interface StoresTableRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  status: string;
  product_count: number;
  created_at: string;
  error_message: string | null;
  cover: string | null;
}

interface StoresTableProps {
  rows: StoresTableRow[];
  /** True when more rows exist on other pages (server-side pagination). */
  paginated?: boolean;
}

type StatusFilter = 'all' | 'published' | 'ready' | 'generating' | 'needs_repair' | 'failed' | 'draft';

function bucketOf(status: string): Exclude<StatusFilter, 'all'> {
  if (status === 'published' || status === 'active') return 'published';
  if (status === 'ready') return 'ready';
  if (status === 'generating' || status === 'creating') return 'generating';
  if (status === 'needs_repair') return 'needs_repair';
  if (status === 'draft') return 'draft';
  return 'failed';
}

function statusLabel(status: string): string {
  if (status === 'published' || status === 'active') return 'En ligne';
  if (status === 'ready') return 'Prêt (non publié)';
  if (status === 'generating' || status === 'creating') return 'Génération…';
  if (status === 'needs_repair') return 'À réparer';
  if (status === 'draft') return 'Brouillon';
  return 'Erreur';
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return dateFmt.format(d);
}

export function StoresTable({ rows, paginated = false }: StoresTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((store) => {
      if (statusFilter !== 'all' && bucketOf(store.status) !== statusFilter) return false;
      if (!q) return true;
      return (
        store.name.toLowerCase().includes(q) ||
        store.slug.toLowerCase().includes(q) ||
        store.niche.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const countLabel = paginated
    ? `${filtered.length} / ${rows.length} sur cette page`
    : `${filtered.length} store${filtered.length > 1 ? 's' : ''}`;

  return (
    <div className="space-y-4">
      <AdminToolbar
        boxed
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Rechercher un store, une niche…',
        }}
        filters={[
          {
            label: 'Statut',
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as StatusFilter),
            options: [
              { label: 'Tous les statuts', value: 'all' },
              { label: 'En ligne', value: 'published' },
              { label: 'Prêt', value: 'ready' },
              { label: 'En génération', value: 'generating' },
              { label: 'À réparer', value: 'needs_repair' },
              { label: 'En erreur', value: 'failed' },
            ],
          },
        ]}
        count={countLabel}
      />

      {filtered.length === 0 ? (
        <AdminEmptyState
          icon={BuildingStorefrontIcon}
          title="Aucun store ne correspond"
          description="Ajuste la recherche ou le filtre de statut pour retrouver un store."
          action={
            <Button
              plain
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
            >
              Réinitialiser les filtres
            </Button>
          }
        />
      ) : (
        <AdminDataTable>
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Store</TableHeader>
                <TableHeader>Statut</TableHeader>
                <TableHeader className="text-right hidden sm:table-cell">Produits</TableHeader>
                <TableHeader className="text-right hidden md:table-cell">Créé</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((store) => {
                const isFailed = store.status === 'failed' || store.status === 'error' || store.status === 'needs_repair';
                const subtext = [`/shop/${store.slug}`, store.niche || null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-zinc-950 ring-1 ring-zinc-800">
                          {store.cover ? (
                            <Image
                              src={store.cover}
                              alt={store.name}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : (
                            <StoreAvatar
                              slug={store.slug}
                              name={store.name}
                              size={36}
                              className="size-full rounded-none"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">
                            {store.name}
                          </div>
                          <div
                            className="truncate text-xs text-zinc-500"
                            title={subtext}
                          >
                            {subtext}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <AdminBadge status={store.status}>{statusLabel(store.status)}</AdminBadge>
                        {isFailed && store.error_message ? (
                          <span
                            className="max-w-[18rem] truncate text-xs text-zinc-500"
                            title={store.error_message}
                          >
                            {store.error_message}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500 hidden sm:table-cell">
                      {store.product_count}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums text-zinc-500 hidden md:table-cell">
                      {formatDate(store.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button plain href={`/admin/stores/${store.id}`}>
                          Gérer
                        </Button>
                        {(store.status === 'published' || store.status === 'active' || store.status === 'ready') && (
                          <Button
                            plain
                            href={`/shop/${store.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Ouvrir la boutique"
                            title="Ouvrir la boutique"
                          >
                            <ArrowTopRightOnSquareIcon aria-hidden />
                          </Button>
                        )}
                        <StoreActions storeId={store.id} storeName={store.name} compact />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </AdminDataTable>
      )}
    </div>
  );
}
