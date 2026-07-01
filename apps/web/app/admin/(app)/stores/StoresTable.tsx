'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import { StoreAvatar } from '@/components/ui';
import { Badge } from '@/components/catalyst/badge';
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
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { StoreActions } from './StoreActions';

type StatusColor = 'green' | 'amber' | 'red';

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

type StatusFilter = 'all' | 'active' | 'creating' | 'failed';

function bucketOf(status: string): Exclude<StatusFilter, 'all'> {
  if (status === 'active') return 'active';
  if (status === 'creating') return 'creating';
  return 'failed';
}

function statusOf(status: string): { color: StatusColor; label: string } {
  if (status === 'active') return { color: 'green', label: 'En ligne' };
  if (status === 'creating') return { color: 'amber', label: 'Création en cours' };
  return { color: 'red', label: 'Erreur' };
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
              { label: 'En ligne', value: 'active' },
              { label: 'En création', value: 'creating' },
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
        />
      ) : (
        <AdminDataTable minWidth="min-w-[56rem]">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Store</TableHeader>
                <TableHeader>Niche</TableHeader>
                <TableHeader>Statut</TableHeader>
                <TableHeader className="text-right">Produits</TableHeader>
                <TableHeader className="text-right">Commandes 7 j</TableHeader>
                <TableHeader className="text-right">Revenu 7 j</TableHeader>
                <TableHeader>Créé le</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((store) => {
                const s = statusOf(store.status);
                const isFailed = store.status !== 'active' && store.status !== 'creating';
                return (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-950/10 dark:bg-white/5 dark:ring-white/10">
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
                          <div className="truncate font-medium text-zinc-950 dark:text-white">
                            {store.name}
                          </div>
                          <div className="truncate text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                            /shop/{store.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-500 dark:text-zinc-400">
                      {store.niche || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge color={s.color}>{s.label}</Badge>
                        {isFailed && store.error_message ? (
                          <span
                            className="max-w-[18rem] truncate text-xs text-red-600 dark:text-red-400"
                            title={store.error_message}
                          >
                            {store.error_message}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {store.product_count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      —
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      —
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {formatDate(store.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button plain href={`/admin/stores/${store.id}`}>
                          Gérer
                        </Button>
                        {store.status === 'active' && (
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
