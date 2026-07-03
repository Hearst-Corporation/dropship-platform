'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Route-level error boundary for /shop/[slug]. Storefront-specific so a
 * broken product fetch or store-config lookup doesn't bubble all the way up
 * to the generic root error page and lose store context. Keeps the visitor
 * on the same store and offers a retry.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main
      className="min-h-[80vh] flex items-center justify-center px-6"
      style={{ background: 'var(--ct-bg-deep)', color: 'var(--ct-text-primary)' }}
    >
      <div className="max-w-md text-center">
        <p
          className="text-kicker uppercase tracking-kicker font-medium mb-5"
          style={{ color: 'var(--ct-text-muted)' }}
        >
          Erreur
        </p>
        <h1 className="font-semibold tracking-tight text-4xl sm:text-5xl leading-none mb-5">
          La boutique n&apos;a pas pu charger.
        </h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'var(--ct-text-body)' }}>
          Une erreur a interrompu le chargement des produits. Réessayez dans un instant.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm font-medium uppercase tracking-cta transition-colors hover:-translate-y-0.5"
            style={{ background: 'var(--ct-accent)', color: 'var(--ct-text-strong)' }}
          >
            Réessayer
          </button>
        </div>
        {error.digest && (
          <p className="mt-10 text-kicker uppercase tracking-label" style={{ color: 'var(--ct-text-muted)' }}>
            Référence · {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
