import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { medusa, type MedusaProduct } from '@/lib/medusa';
import { Heading } from '@/components/catalyst/heading';
import { Text, Code } from '@/components/catalyst/text';
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Catalogue Medusa</Heading>
          <Text className="mt-1 max-w-2xl">
            Tous les SKU publiés par l&apos;agent. Source de vérité du stock e-commerce, indépendante des
            storefronts.
          </Text>
        </div>
        <Text className="tabular-nums">
          {products.length} produit{products.length > 1 ? 's' : ''}
          {drafts > 0 ? ` · ${drafts} brouillon${drafts > 1 ? 's' : ''}` : ''}
          {published > 0 ? ` · ${published} publié${published > 1 ? 's' : ''}` : ''}
        </Text>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/5 p-6 ring-1 ring-inset ring-red-500/20">
          <Text className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            Erreur Medusa
          </Text>
          <Text className="mt-1.5">{error}</Text>
        </div>
      )}

      {!error && products.length === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-lg p-6 ring-1 ring-inset ring-zinc-950/5 dark:ring-white/10">
          <div className="text-center">
            <Text>
              <strong>Aucun produit publié pour le moment.</strong>
            </Text>
            <Text className="mt-1">Lance l&apos;agent pour publier les premiers SKU.</Text>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div className="rounded-lg bg-white p-6 ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader className="w-16" />
                <TableHeader>Produit</TableHeader>
                <TableHeader>Handle</TableHeader>
                <TableHeader>Statut</TableHeader>
                <TableHeader>Variantes</TableHeader>
                <TableHeader className="text-right">Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnail}
                        alt=""
                        className="size-11 rounded-lg object-cover ring-1 ring-inset ring-zinc-950/10 dark:ring-white/10"
                      />
                    ) : (
                      <div className="size-11 rounded-lg bg-zinc-950/5 ring-1 ring-inset ring-zinc-950/10 dark:bg-white/5 dark:ring-white/10" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    <Code>{p.handle}</Code>
                  </TableCell>
                  <TableCell>
                    <Badge color={p.status === 'published' ? 'green' : 'zinc'}>{p.status}</Badge>
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
        </div>
      )}
    </div>
  );
}
