/**
 * QA publish gate — the last line before a store goes public.
 *
 * `evaluateStoreReadiness` checks that the store is *complete* (name, product,
 * hero, Medusa channel…). This gate checks that going public is *safe*:
 *
 *   1. Checkout — never expose a LIVE-Stripe checkout that hasn't been proven
 *      end-to-end (payment → capture → order → fulfillment).
 *   2. Image ownership — the product image must be persisted (R2 / local),
 *      never a raw supplier hotlink that can expire on a live store.
 *   3. Compliance — no health/medical claims in the generated copy.
 *   4. Template — not the generic `auto` fallback (a store must have a real
 *      storefront identity, not a colour-swapped generic page).
 *   5. Provider — the product must come from a real, reliable supplier, never
 *      the AI-generated fallback, unless explicitly flagged.
 *
 * Any hard blocker here makes the store non-publishable, regardless of
 * readiness score.
 */
import { getDbRead } from '@/lib/db';
import { stripeIsLive, checkoutVerified } from '@/lib/stripe-env';

export interface PublishGuardResult {
  ok: boolean;
  blockers: string[];
  warnings: string[];
}

const HEALTH_CLAIM_PATTERNS = [
  /th[ée]rapeut/i,
  /anti[-\s]?inflammat/i,
  /gu[ée]ri/i,
  /soigne/i,
  /soulage la douleur/i,
  /am[ée]liore la circulation/i,
  /cliniquement prouv/i,
  /certifi[ée] m[ée]dical/i,
  /recommand[ée] par (un )?(kin[ée]|m[ée]decin)/i,
  /trait(e|ement) (la|les|de la) (douleur|inflammation)/i,
];

interface Row {
  template: string | null;
  landing_content: unknown;
}
interface ProductRow {
  supplier: string;
  image_url: string | null;
}

function scanHealthClaims(landing: unknown): string[] {
  const blob = typeof landing === 'string' ? landing : JSON.stringify(landing ?? {});
  const hits = HEALTH_CLAIM_PATTERNS.filter((re) => re.test(blob));
  return hits.map((re) => re.source);
}

export async function evaluatePublishGuard(storeId: string): Promise<PublishGuardResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Checkout safety — global, env-driven.
  if (stripeIsLive() && !checkoutVerified()) {
    blockers.push(
      'Checkout en clés Stripe LIVE non validé end-to-end (CHECKOUT_E2E_VERIFIED != true). Publication bloquée : jamais de débit réel sur un tunnel non prouvé.',
    );
  }

  const db = getDbRead();
  const storeRes = await db.query<Row>(
    `SELECT template, landing_content FROM dropship_stores WHERE id = $1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) return { ok: false, blockers: ['Store introuvable'], warnings };

  // 4. Template must be a real storefront, not the generic fallback.
  if (!store.template || store.template === 'auto') {
    blockers.push('Template générique (`auto`) — un store doit avoir une vraie identité storefront.');
  }

  // 3. Compliance — no health claims in the generated copy.
  const claims = scanHealthClaims(store.landing_content);
  if (claims.length) {
    blockers.push(`Claims santé/thérapeutiques détectés dans la copy: ${claims.slice(0, 3).join(', ')}`);
  }

  const prodRes = await db.query<ProductRow>(
    `SELECT supplier, image_url FROM dropship_store_products WHERE store_id = $1`,
    [storeId],
  );
  for (const p of prodRes.rows) {
    // 2. Image ownership — no supplier hotlink.
    if (p.image_url && /aliexpress-media|alicdn|cjdropshipping|cf\.cjdropshipping/i.test(p.image_url)) {
      blockers.push('Image produit hotlinkée depuis le fournisseur (non persistée) — expire sur un store live.');
    }
    // 5. Provider reliability — no unflagged AI fallback.
    if (p.supplier === 'ai-generated') {
      blockers.push('Produit issu du fallback IA (non sourcé chez un vrai fournisseur).');
    }
  }

  return { ok: blockers.length === 0, blockers, warnings };
}
