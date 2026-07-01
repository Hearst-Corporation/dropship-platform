/**
 * Client-safe Medusa helpers shared by the admin client (lib/medusa.ts,
 * server-only) and the store client (lib/medusa-store.ts, imported by
 * 'use client' components).
 *
 * IMPORTANT: this module MUST stay free of `import 'server-only'` and of any
 * admin-credential reads (MEDUSA_ADMIN_*). It only resolves the public base
 * URL, so it is safe to bundle into the client. Keeping the admin creds out of
 * here is what prevents lib/medusa.ts from being pulled transitively into the
 * client bundle.
 */

const DEV_FALLBACK_MEDUSA_URL = 'https://medusa-production-656a.up.railway.app';

/**
 * URL Medusa : on requiert `MEDUSA_URL` (ou `NEXT_PUBLIC_MEDUSA_URL`) en prod
 * Vercel. En dev local on accepte un fallback hardcodé pour ne pas bloquer
 * `npm run dev` quand l'env n'est pas câblé. Toute autre absence d'URL
 * déclenche une erreur explicite plutôt que de laisser fuiter une URL
 * Railway publique en production.
 */
export function getMedusaBaseUrl(): string {
  const raw = (process.env.MEDUSA_URL || process.env.NEXT_PUBLIC_MEDUSA_URL || '').trim();
  const fromEnv = raw.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('[medusa] MEDUSA_URL is required in production');
  }
  if (process.env.NODE_ENV === 'development') {
    console.warn('[medusa] MEDUSA_URL missing, using dev fallback');
    return DEV_FALLBACK_MEDUSA_URL.replace(/\/$/, '');
  }
  return '';
}
