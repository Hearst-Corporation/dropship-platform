import { ChevronLeftIcon } from '@heroicons/react/20/solid';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
import { Button } from '@/components/catalyst/button';

export const dynamic = 'force-dynamic';

/**
 * Template preview — the 24 bespoke landing templates were removed (audit
 * cleanup). Stores now render the generic storefront (hero + product grid),
 * so there is no per-template preview to show. Kept as a route so existing
 * links don't 404.
 */
export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Aperçu indisponible</Heading>
          <Text>{`Le template « ${id} » n'a plus d'aperçu : les designs sur mesure ont été retirés.`}</Text>
        </div>
        <Button plain href="/admin/templates">
          <ChevronLeftIcon aria-hidden />
          Templates
        </Button>
      </div>
      <div>
        <Subheading>Storefront générique</Subheading>
        <Text className="mt-2 max-w-md">
          Toutes les boutiques rendent désormais le storefront standard (hero + grille produits)
          piloté par la palette du store. Il n&apos;y a plus de templates sur mesure à prévisualiser.
        </Text>
      </div>
    </div>
  );
}
