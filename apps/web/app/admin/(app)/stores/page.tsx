import Link from 'next/link';
import Image from 'next/image';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { getDbRead } from '@/lib/db';
import { StoreAvatar } from '@/components/ui';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
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
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from '@/components/catalyst/description-list';
import { StoreActions } from './StoreActions';

export const dynamic = 'force-dynamic';

type StatusColor = 'green' | 'amber' | 'red';

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  tagline: string;
  logo_emoji: string;
  primary_color: string;
  accent_color: string;
  status: string;
  product_count: number;
  created_at: string;
  error_message: string | null;
  hero_image_url: string | null;
  cutout_image_url: string | null;
  lifestyle_images: unknown;
}

function pickStoreCover(s: StoreRow): string | null {
  if (s.hero_image_url) return s.hero_image_url;
  const lifestyles = Array.isArray(s.lifestyle_images)
    ? (s.lifestyle_images as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];
  if (lifestyles[0]) return lifestyles[0];
  if (s.cutout_image_url) return s.cutout_image_url;
  return null;
}

function statusOf(s: StoreRow): { color: StatusColor; label: string } {
  if (s.status === 'active') return { color: 'green', label: 'En ligne' };
  if (s.status === 'creating') return { color: 'amber', label: 'Création en cours' };
  return { color: 'red', label: 'Erreur' };
}

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = 24;
  const offset = (page - 1) * pageSize;

  const db = getDbRead();

  const countRes = await db.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM dropship_stores`,
  );
  const total = countRes.rows[0]?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const { rows } = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, tagline, logo_emoji, primary_color, accent_color,
            status, product_count, error_message, created_at,
            hero_image_url, cutout_image_url, lifestyle_images
     FROM dropship_stores ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset],
  );

  const active = rows.filter((s) => s.status === 'active');
  const creating = rows.filter((s) => s.status === 'creating');
  const failed = rows.filter((s) => s.status !== 'active' && s.status !== 'creating');
  const totalProducts = active.reduce((acc, s) => acc + (s.product_count || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Text className="text-xs/5 font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
            Production · Agent IA
          </Text>
          <Heading>Stores dropshipping</Heading>
          <Text>
            L&apos;agent recherche les produits, enrichit les fiches puis publie le store Medusa
            complet.
          </Text>
        </div>
        <Button color="indigo" href="/admin/stores/new">
          Nouveau store
        </Button>
      </div>

      <DescriptionList>
        <DescriptionTerm>En ligne</DescriptionTerm>
        <DescriptionDetails className="tabular-nums">{active.length}</DescriptionDetails>
        <DescriptionTerm>En création</DescriptionTerm>
        <DescriptionDetails className="tabular-nums">{creating.length}</DescriptionDetails>
        <DescriptionTerm>En erreur</DescriptionTerm>
        <DescriptionDetails className="tabular-nums">{failed.length}</DescriptionDetails>
        <DescriptionTerm>Produits publiés</DescriptionTerm>
        <DescriptionDetails className="tabular-nums">{totalProducts}</DescriptionDetails>
      </DescriptionList>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <Table dense className="min-w-0">
          <TableHead>
            <TableRow>
              <TableHeader>Store</TableHeader>
              <TableHeader>Niche</TableHeader>
              <TableHeader>Statut</TableHeader>
              <TableHeader className="text-right">Produits</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
              {rows.map((store) => {
                const s = statusOf(store);
                const cover = pickStoreCover(store);
                return (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-950/10 dark:bg-white/5 dark:ring-white/10">
                          {cover ? (
                            <Image src={cover} alt="" fill sizes="36px" className="object-cover" />
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
                          <div className="truncate text-xs tabular-nums text-zinc-500">
                            /shop/{store.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-500">{store.niche}</TableCell>
                    <TableCell>
                      <Badge color={s.color}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-500">
                      {store.product_count}
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
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2">
          <PaginationLink page={page - 1} disabled={page <= 1} label="← Précédent" />
          <Text className="px-3 tabular-nums">
            Page {page} / {totalPages}
          </Text>
          <PaginationLink page={page + 1} disabled={page >= totalPages} label="Suivant →" />
        </nav>
      )}
    </div>
  );
}

function PaginationLink({
  page,
  disabled,
  label,
}: {
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <Button plain disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button plain href={`/admin/stores?page=${page}`}>
      {label}
    </Button>
  );
}

function EmptyState() {
  return (
    <div className="py-20 text-center">
      <Text className="text-xs/5 font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
        Premier pas
      </Text>
      <Subheading className="mt-2">Lance ton premier store.</Subheading>
      <Text className="mx-auto mt-2 max-w-md">
        L&apos;agent IA recherche les produits, génère les visuels, écrit les fiches et publie le
        store. Une niche suffit.
      </Text>
      <div className="mt-6">
        <Button color="indigo" href="/admin/stores/new">
          Créer un store
        </Button>
      </div>
    </div>
  );
}
