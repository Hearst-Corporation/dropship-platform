/**
 * Forward a paid Medusa order to the appropriate supplier for fulfillment.
 *
 * Default behaviour is dry-run: we build the payload and persist it in
 * `dropship_order_forwards` but never call the supplier. Set `dryRun: false`
 * (and pass an explicit `confirm: true`) to actually place the order.
 *
 * Supplier dispatch is via the registry — adding a new supplier only requires
 * registering it in `lib/suppliers/registry.ts` and setting `placeOrder`.
 */

import { medusa, type MedusaOrder } from '@/lib/medusa';
import { aliExpressOrderUrl } from '@/lib/suppliers/aliexpress';
import { getSupplier, isSupplierId, type SupplierId } from '@/lib/suppliers/registry';
import { assertDropshipPure, canAutoForward } from '@/lib/suppliers/policy';
import type { PlaceOrderInput, SupplierOrderItem, SupplierAddress } from '@/lib/suppliers/types';
import { getDb } from '@/lib/db';
import { retry } from '@/lib/retry';

interface OrderAttribution {
  /** Visitor session id — joins dropship_funnel_events.session_id. */
  session_id?: string;
  /** Shared event UUID with the funnel purchase row + Meta/TikTok dedup. */
  event_id?: string;
  /** Snapshot of the utm_attribution cookie at purchase time. */
  attribution?: Record<string, unknown>;
}

interface ForwardOptions {
  dryRun: boolean;
  /** Override the province if the Medusa shipping address has none. AE requires it. */
  provinceOverride?: string;
  /**
   * Explicit attribution context to persist on the forward row. When
   * omitted (the common case — forward is triggered hours after checkout
   * via the admin button), we look it up from dropship_funnel_events on
   * the matching purchase row. Pass it explicitly only when the caller
   * already has the values in hand (e.g. inline forward right after
   * /api/checkout/complete).
   */
  attribution?: OrderAttribution;
}

interface ForwardResult {
  ok: boolean;
  status: 'dry_run' | 'sent' | 'error';
  forwardId: string;            // dropship_order_forwards.id
  supplierOrderId?: string;
  payload: PlaceOrderInput;
  error?: string;
  /** Items the agent could not map to a forwardable supplier — always to be reviewed. */
  unmappedItems: { itemId: string; title: string; reason: string }[];
}

function digitsOnly(s: string | undefined | null): string {
  return (s || '').replace(/\D+/g, '');
}

// ISO-2 country code → ITU dial code (without +).
// Covers the storefront's supported countries plus a few neighbours; extend as needed.
const DIAL_BY_COUNTRY: Record<string, string> = {
  fr: '33', be: '32', de: '49', it: '39', nl: '31', pt: '351', es: '34',
  gb: '44', uk: '44', ie: '353', ch: '41', at: '43', lu: '352',
  us: '1', ca: '1',
};

function splitPhone(raw: string | undefined | null, countryCode: string | undefined | null): { dial: string; number: string } {
  const country = (countryCode || 'fr').toLowerCase();
  const expected = DIAL_BY_COUNTRY[country] ?? '33';
  const cleaned = (raw || '').trim();
  if (!cleaned) return { dial: expected, number: '' };

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1).replace(/\D+/g, '');
    // Strip the country dial deterministically, no greedy regex.
    if (digits.startsWith(expected)) {
      return { dial: expected, number: digits.slice(expected.length) };
    }
    // Phone says +<X> but X doesn't match the address country — keep the
    // user's dial code by trying every known prefix from longest to shortest.
    const sorted = Object.values(DIAL_BY_COUNTRY).sort((a, b) => b.length - a.length);
    for (const dial of sorted) {
      if (digits.startsWith(dial)) {
        return { dial, number: digits.slice(dial.length) };
      }
    }
    // Last-resort: assume a 1-2 digit dial.
    const m = digits.match(/^(\d{1,2})(\d{6,})$/);
    if (m) return { dial: m[1], number: m[2] };
    return { dial: expected, number: digits };
  }

  // No leading "+": treat the whole input as the local number, drop a leading 0
  // (FR pattern "0612345678" → "612345678").
  const local = digitsOnly(cleaned).replace(/^0/, '');
  return { dial: expected, number: local };
}

function buildSupplierAddress(order: MedusaOrder, provinceOverride?: string): { address: SupplierAddress; missing: string[] } {
  const a = order.shipping_address ?? {};
  const fullName = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
  const province = (a.province || provinceOverride || '').trim();
  const phone = splitPhone(a.phone, a.country_code);

  const missing: string[] = [];
  if (!fullName) missing.push('full_name');
  if (!a.address_1) missing.push('address');
  if (!a.city) missing.push('city');
  if (!a.country_code) missing.push('country');
  if (!a.postal_code) missing.push('zip');
  if (!province) missing.push('province');
  if (!phone.number) missing.push('mobile_no');

  const address: SupplierAddress = {
    address1: a.address_1 || '',
    address2: a.address_2 || undefined,
    city: a.city || '',
    contactPerson: fullName || order.email || '',
    countryCode: (a.country_code || '').toUpperCase(),
    fullName: fullName || order.email || '',
    phoneNumber: phone.number,
    phoneDial: phone.dial,
    province,
    zip: a.postal_code || '',
  };

  return { address, missing };
}

interface ProductMapping {
  medusa_product_id: string;
  external_id: string;
  store_id: string;
  supplier: string;
}

/**
 * Resolve Medusa order items to supplier items, applying registry/policy gates.
 *
 * Rules:
 * 1. Items with no row in dropship_store_products → unmapped ("No row in ...").
 * 2. Items whose supplier is not in the registry (e.g. 'ai-generated') → unmapped.
 * 3. Items whose supplier is search_only (e.g. CJ) → unmapped ("not auto-forwardable").
 * 4. Items whose supplier differs from the first-seen forwardable supplier →
 *    unmapped ("mixed-supplier order — supplier=X deferred") — we only forward
 *    one supplier leg per call to preserve the existing single-lock behaviour.
 * 5. Invalid quantity → unmapped.
 */
async function mapItemsToSupplier(order: MedusaOrder): Promise<{
  items: SupplierOrderItem[];
  unmapped: { itemId: string; title: string; reason: string }[];
  storeId?: string;
  forwardSupplier?: SupplierId;
}> {
  const orderItems = order.items ?? [];
  if (orderItems.length === 0) return { items: [], unmapped: [], storeId: undefined };

  const productIds = Array.from(new Set(orderItems.map((i) => i.product_id).filter(Boolean)));
  if (productIds.length === 0) {
    return {
      items: [],
      unmapped: orderItems.map((i) => ({ itemId: i.id, title: i.title, reason: 'Medusa item has no product_id' })),
    };
  }

  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await getDb().query<ProductMapping>(
    `SELECT medusa_product_id, external_id, store_id, supplier
       FROM dropship_store_products
      WHERE medusa_product_id IN (${placeholders})`,
    productIds,
  );

  const byMedusaId = new Map(rows.map((r) => [r.medusa_product_id, r]));

  const items: SupplierOrderItem[] = [];
  const unmapped: { itemId: string; title: string; reason: string }[] = [];
  let storeId: string | undefined;
  let forwardSupplier: SupplierId | undefined;

  for (const item of orderItems) {
    const mapping = byMedusaId.get(item.product_id);
    if (!mapping) {
      unmapped.push({ itemId: item.id, title: item.title, reason: 'No row in dropship_store_products' });
      continue;
    }

    // Gate 1: supplier must be a known registry id (rejects 'ai-generated', unknown strings).
    if (!isSupplierId(mapping.supplier)) {
      unmapped.push({
        itemId: item.id,
        title: item.title,
        reason: `supplier=${mapping.supplier} is not a registered supplier`,
      });
      continue;
    }

    // Gate 2: supplier must support automated order placement.
    const client = getSupplier(mapping.supplier);
    if (!canAutoForward(client)) {
      unmapped.push({
        itemId: item.id,
        title: item.title,
        reason: `supplier=${mapping.supplier} (${client.status}) is not auto-forwardable`,
      });
      continue;
    }

    // Gate 3: all forwardable items in one call must share the same supplier.
    // If this item's supplier differs from the first-seen one, defer it.
    if (forwardSupplier === undefined) {
      forwardSupplier = mapping.supplier;
    } else if (mapping.supplier !== forwardSupplier) {
      unmapped.push({
        itemId: item.id,
        title: item.title,
        reason: `mixed-supplier order — supplier=${mapping.supplier} deferred`,
      });
      continue;
    }

    storeId = mapping.store_id;

    if (!item.quantity || item.quantity <= 0) {
      unmapped.push({ itemId: item.id, title: item.title, reason: `Invalid quantity ${item.quantity}` });
      continue;
    }

    // Only forward the SKU when it's already in the supplier's expected shape
    // (e.g. AE "14:175;5:100"); otherwise let the supplier pick the default.
    const sku = item.variant?.sku;
    const shapedSku = sku && /^\d+:\d+(;\d+:\d+)*$/.test(sku) ? sku : undefined;

    items.push({
      externalId: mapping.external_id,
      quantity: item.quantity,
      ...(shapedSku ? { skuAttr: shapedSku } : {}),
    });
  }

  return { items, unmapped, storeId, forwardSupplier };
}

/**
 * Look up the purchase-time attribution captured in
 * `dropship_funnel_events` for this order. Returns nulls if no purchase
 * row exists (older orders, opted-out visitors, race condition) — that's
 * non-fatal, attribution is best-effort by design.
 */
async function loadAttributionForOrder(medusaOrderId: string): Promise<OrderAttribution> {
  try {
    const { rows } = await getDb().query<{
      session_id: string | null;
      event_id: string | null;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      utm_term: string | null;
      utm_content: string | null;
      fbclid: string | null;
      ttclid: string | null;
    }>(
      `SELECT session_id, event_id,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content,
              fbclid, ttclid
         FROM dropship_funnel_events
        WHERE medusa_order_id = $1
          AND event_name = 'purchase'
        ORDER BY created_at ASC
        LIMIT 1`,
      [medusaOrderId],
    );
    const row = rows[0];
    if (!row) return {};
    const attribution: Record<string, unknown> = {
      utm_source: row.utm_source,
      utm_medium: row.utm_medium,
      utm_campaign: row.utm_campaign,
      utm_term: row.utm_term,
      utm_content: row.utm_content,
      fbclid: row.fbclid,
      ttclid: row.ttclid,
    };
    const hasAnyUtm = Object.values(attribution).some((v) => v !== null && v !== undefined);
    return {
      session_id: row.session_id ?? undefined,
      event_id: row.event_id ?? undefined,
      attribution: hasAnyUtm ? attribution : undefined,
    };
  } catch (e) {
    // Schema not migrated yet, table missing in test DBs, anything: never
    // block a forward on the attribution lookup.
    console.warn('[order-forwarder] attribution lookup failed', e);
    return {};
  }
}

/**
 * Forward a single Medusa order. Persists the attempt — dry-run or live —
 * to `dropship_order_forwards`.
 */
export async function forwardOrder(medusaOrderId: string, opts: ForwardOptions): Promise<ForwardResult> {
  const order = await medusa.getOrder(medusaOrderId);
  const { items, unmapped, storeId, forwardSupplier } = await mapItemsToSupplier(order);
  const { address, missing } = buildSupplierAddress(order, opts.provinceOverride);

  const payload: PlaceOrderInput = {
    outOrderId: medusaOrderId,
    address,
    items,
  };

  // Hydrate attribution context. Caller-provided wins; otherwise we look
  // it up from the funnel log. Result may have any subset of fields —
  // unknown fields stay NULL in the insert.
  const attributionCtx = opts.attribution ?? (await loadAttributionForOrder(medusaOrderId));
  const attributionJson = attributionCtx.attribution ? JSON.stringify(attributionCtx.attribution) : null;
  const sessionId = attributionCtx.session_id ?? null;
  const eventId = attributionCtx.event_id ?? null;

  const db = getDb();

  // Hard gates: nothing to ship, missing address, or all items unmapped.
  const hardError =
    items.length === 0
      ? `No mappable items (unmapped: ${unmapped.length})`
      : missing.length > 0
        ? `Missing required address fields: ${missing.join(', ')}`
        : null;

  if (hardError) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_order_forwards
         (medusa_order_id, store_id, payload, status, error_message, dry_run,
          attribution_json, session_id, event_id, supplier)
       VALUES ($1, $2, $3, 'error', $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        medusaOrderId,
        storeId ?? null,
        JSON.stringify(payload),
        hardError,
        opts.dryRun,
        attributionJson,
        sessionId,
        eventId,
        forwardSupplier ?? 'aliexpress',
      ],
    );
    return {
      ok: false,
      status: 'error',
      forwardId: rows[0]!.id,
      payload,
      unmappedItems: unmapped,
      error: hardError,
    };
  }

  if (opts.dryRun) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_order_forwards
         (medusa_order_id, store_id, payload, status, dry_run,
          attribution_json, session_id, event_id, supplier)
       VALUES ($1, $2, $3, 'dry_run', true, $4, $5, $6, $7)
       RETURNING id`,
      [
        medusaOrderId,
        storeId ?? null,
        JSON.stringify(payload),
        attributionJson,
        sessionId,
        eventId,
        forwardSupplier!,
      ],
    );
    return {
      ok: true,
      status: 'dry_run',
      forwardId: rows[0]!.id,
      payload,
      unmappedItems: unmapped,
    };
  }

  // Live: claim the slot first so a concurrent click can't place a second
  // supplier order. The unique partial index on (medusa_order_id, supplier)
  // WHERE dry_run=false AND status IN ('sending','sent') turns the second
  // INSERT into a 23505 (unique_violation), which we treat as "another caller
  // is/has already forwarded this order for this supplier".
  let lockId: string;
  try {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_order_forwards
         (medusa_order_id, store_id, payload, status, dry_run,
          attribution_json, session_id, event_id, supplier)
       VALUES ($1, $2, $3, 'sending', false, $4, $5, $6, $7)
       RETURNING id`,
      [
        medusaOrderId,
        storeId ?? null,
        JSON.stringify(payload),
        attributionJson,
        sessionId,
        eventId,
        forwardSupplier!,
      ],
    );
    lockId = rows[0]!.id;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === '23505') {
      console.warn('[order-forwarder] live send already in-flight or completed', { medusaOrderId, forwardSupplier });
      return {
        ok: false,
        status: 'error',
        forwardId: '',
        payload,
        unmappedItems: unmapped,
        error: 'Another live forward is already in-flight or completed for this order.',
      };
    }
    throw e;
  }

  // Fail-closed guard: re-assert the supplier is auto-forwardable immediately
  // before we send (catches any runtime state mismatch).
  const client = getSupplier(forwardSupplier!);
  try {
    assertDropshipPure(client);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'assertDropshipPure failed';
    console.error('[order-forwarder] assertDropshipPure rejected', { medusaOrderId, forwardSupplier, error: errMsg });
    await db.query(
      `UPDATE dropship_order_forwards
          SET response = $1, status = 'error', error_message = $2
        WHERE id = $3`,
      [null, errMsg, lockId],
    );
    return {
      ok: false,
      status: 'error',
      forwardId: lockId,
      payload,
      unmappedItems: unmapped,
      error: errMsg,
    };
  }

  // Retry supplier placeOrder on 5xx and network errors.
  // placeOrder must never throw for application errors — it returns
  // { success: false, error }. We promote transient failures to thrown errors
  // so retry() can catch and back-off them.
  const isTransient = (errMsg: string | undefined): boolean =>
    /HTTP\s+5\d\d|network|timeout|abort|fetch|econnreset|etimedout/i.test(errMsg ?? '');

  const res = await retry(
    async () => {
      const r = await client.placeOrder!(payload);
      if (!r.success && isTransient(r.error)) {
        // Promote to a thrown Error so retry() can back-off and retry.
        throw new Error(r.error ?? 'Supplier transient error');
      }
      return r;
    },
    {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 8000,
      backoffMultiplier: 2,
      jitter: true,
      // Only retry on the transient errors we just promoted to throws.
      isRetryable: (e) => e instanceof Error && isTransient(e.message),
    },
  ).catch((e: unknown) => {
    // All retries exhausted — return a failure result so the forwarder can
    // update the DB row to status='error' as before.
    const msg = e instanceof Error ? e.message : 'Supplier transient error after retries';
    return { success: false as const, raw: null, supplierOrderId: undefined, error: msg };
  });

  if (res.success) {
    // Back-compat: ae_order_id column is kept for legacy readers (admin UI,
    // anomaly-watch, orders route). Write it only for AliExpress rows.
    const aeOrderId = forwardSupplier === 'aliexpress' ? (res.supplierOrderId ?? null) : null;
    await db.query(
      `UPDATE dropship_order_forwards
          SET supplier_order_id = $1, ae_order_id = $2, response = $3, status = 'sent'
        WHERE id = $4`,
      [res.supplierOrderId ?? null, aeOrderId, JSON.stringify(res.raw), lockId],
    );
    return {
      ok: true,
      status: 'sent',
      forwardId: lockId,
      supplierOrderId: res.supplierOrderId,
      payload,
      unmappedItems: unmapped,
    };
  }

  console.error('[order-forwarder] supplier placeOrder failed', {
    medusaOrderId,
    forwardSupplier,
    error: res.error,
  });
  await db.query(
    `UPDATE dropship_order_forwards
        SET response = $1, status = 'error', error_message = $2
      WHERE id = $3`,
    [JSON.stringify(res.raw), res.error ?? 'unknown error', lockId],
  );
  return {
    ok: false,
    status: 'error',
    forwardId: lockId,
    payload,
    unmappedItems: unmapped,
    error: res.error,
  };
}

// Re-export for legacy readers that build AE deep-links.
export { aliExpressOrderUrl };
