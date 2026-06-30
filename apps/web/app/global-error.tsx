'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Last-resort error boundary. Catches errors thrown inside the root layout
 * itself (where a regular `error.tsx` can't help — its segment never
 * mounts). Self-contained: doesn't rely on the design system because the
 * design system might be what's broken. Inline styles only.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      {/* global-error remplace <html> : si la feuille Tailwind n'est pas chargée
          à ce niveau, ce fallback inline minimal garantit un rendu centré lisible. */}
      <body
        className="m-0 min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6"
        style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div className="max-w-md text-center">
          <p className="text-xs tracking-widest uppercase text-zinc-400 mb-5">
            Erreur
          </p>
          <h1 className="text-3xl leading-tight font-semibold mb-5">
            Quelque chose s&apos;est mal pass&eacute;.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Rechargez la page pour réessayer. Votre panier reste intact.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-7 py-3.5 text-xs font-medium uppercase tracking-widest text-zinc-900 hover:bg-white"
          >
            Réessayer
          </button>
          {error.digest && (
            <p className="mt-8 text-xs tracking-widest uppercase text-zinc-500">
              Référence · {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
