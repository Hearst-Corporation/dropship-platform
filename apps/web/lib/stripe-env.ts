/**
 * Stripe runtime config. Server-side helper exposes whether Stripe is wired up
 * end-to-end (publishable + secret + Medusa region). Client uses NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY only.
 */
export const STRIPE_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();
export const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
export const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();

export function stripeEnabled(): boolean {
  return !!STRIPE_PUBLISHABLE_KEY && !!STRIPE_SECRET_KEY;
}

/** True when the configured Stripe keys are LIVE (real cards), not test. */
export function stripeIsLive(): boolean {
  return /^(pk|sk)_live_/.test(STRIPE_SECRET_KEY) || /^pk_live_/.test(STRIPE_PUBLISHABLE_KEY);
}

/**
 * Operator attestation that the full checkout tunnel (payment → capture →
 * order → fulfillment) has been validated end-to-end. Until this is set,
 * publishing a store on LIVE keys is blocked by the QA publish gate — we
 * never expose a real-card checkout that hasn't been proven.
 */
export function checkoutVerified(): boolean {
  return process.env.CHECKOUT_E2E_VERIFIED === 'true';
}

/** Kill switch: storefront checkout is only live when explicitly enabled. */
export function checkoutEnabled(): boolean {
  return process.env.CHECKOUT_ENABLED === 'true';
}

export const STRIPE_PROVIDER_ID = 'pp_stripe_stripe';
