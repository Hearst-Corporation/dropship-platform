'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

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
        <h1 className="mb-3 text-2xl font-semibold tracking-tight text-gray-100">
          Une erreur est survenue
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-gray-400">
          Le chargement de cette page a été interrompu. Réessayez ou rechargez la
          page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
        >
          Réessayer
        </button>
        {error.digest && (
          <p className="mt-8 text-xs uppercase tracking-wide text-gray-500">
            Référence · {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
