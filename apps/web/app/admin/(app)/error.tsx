'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/catalyst/button';
import { Heading } from '@/components/catalyst/heading';

/**
 * Error boundary de la zone admin (segment (app)). Reste sur le shell sombre
 * pour ne pas remonter à l'error page storefront. L'admin réessaie ou recharge.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-10">
      <div className="max-w-md text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-indigo-400">
          Erreur
        </p>
        <Heading className="mb-3">Une erreur est survenue</Heading>
        <p className="mb-8 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Le chargement de cette page a été interrompu. Réessayez ou rechargez la
          page.
        </p>
        <Button color="indigo" onClick={reset}>
          Réessayer
        </Button>
        {error.digest && (
          <p className="mt-8 text-xs uppercase tracking-wide text-zinc-500">
            Référence · {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
