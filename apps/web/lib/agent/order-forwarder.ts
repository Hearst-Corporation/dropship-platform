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
import { routeOrderViaAutoDS } from '@/lib/automation/autods';

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

/** One forwarded leg = one row in dropship_order_forwards for a single supplier. */
interface ForwardLeg {
  supplier: SupplierId;
  status: 'dry_run' | 'sent' | 'error';
  forwardId: string;            // dropship_order_forwards.id
  supplierOrderId?: string;
  payload: PlaceOrderInput;
  error?: string;
}

interface ForwardResult {
  /** True when every attempted leg succeeded (dry_run counts as ok). */
  ok: boolean;
  /**
   * True when the send was a PARTIAL success: at least one leg sent AND at
   * least one leg errored. A partial send is not a total failure — the route
   * returns HTTP 200 for it (some supplier order was really placed) and the
   * UI must refresh so the sent legs stop looking pending.
   */
  partial: boolean;
  /**
   * Per-supplier legs. A mixed cart forwards one row PER distinct forwardable
   * supplier (the composite lock on (medusa_order_id, supplier) allows this) —
   * no forwardable leg is silently dropped anymore.
   */
  forwards: ForwardLeg[];
  /** Items the agent could not map to a forwardable supplier — always to be reviewed. */
  unmappedItems: { itemId: string; title: string; reason: string }[];
  /**
   * Aggregate status kept for legacy readers (dry-run-pending route, admin UI):
   * 'sent' if every leg is sent, 'dry_run' if every leg is dry_run, else 'error'.
   */
  status: 'dry_run' | 'sent' | 'error';
  /** First error across legs (or the hard-gate error), for legacy readers. */
  error?: string;
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

/** A group of forwardable items sharing one supplier — becomes one forward row. */
interface SupplierGroup {
  supplier: SupplierId;
  items: SupplierOrderItem[];
  /**
   * Known limitation (not a fix): a group assumes a single store per supplier
   * per order — the first mapped item's store_id wins (see mapItemsToSupplier).
   * A cart mixing two stores that share one supplier would attribute the whole
   * leg to the first store.
   */
  storeId?: string;
}

/**
 * Resolve Medusa order items to supplier items, applying registry/policy gates,
 * then GROUP the forwardable items by supplier so each distinct forwardable
 * supplier's leg is forwarded as its own dropship_order_forwards row.
 *
 * Rules:
 * 1. Items with no row in dropship_store_products → unmapped ("No row in ...").
 * 2. Items whose supplier is not in the registry (e.g. 'ai-generated') → unmapped.
 * 3. Items whose supplier is NOT auto-forwardable (search_only like Spocket,
 *    feed-only like Syncee) → unmapped ("not auto-forwardable"). CJ/Zendrop/
 *    BigBuy are `active` + forwardable, so their items are forwarded, not deferred.
 * 4. Invalid quantity → unmapped.
 *
 * Every distinct forwardable supplier gets its OWN group → its own forward row.
 * A mixed cart no longer silently drops the non-first supplier's paid legs.
 */
async function mapItemsToSupplier(order: MedusaOrder): Promise<{
  groups: SupplierGroup[];
  unmapped: { itemId: string; title: string; reason: string }[];
}> {
  const orderItems = order.items ?? [];
  if (orderItems.length === 0) return { groups: [], unmapped: [] };

  const productIds = Array.from(new Set(orderItems.map((i) => i.product_id).filter(Boolean)));
  if (productIds.length === 0) {
    return {
      groups: [],
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

  const groupsBySupplier = new Map<SupplierId, SupplierGroup>();
  const unmapped: { itemId: string; title: string; reason: string }[] = [];

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

    // Gate 2: supplier must support automated order placement (active + placeOrder).
    // Rejects search_only (Spocket) and feed-only (Syncee); CJ/Zendrop/BigBuy pass.
    const client = getSupplier(mapping.supplier);
    if (!canAutoForward(client)) {
      unmapped.push({
        itemId: item.id,
        title: item.title,
        reason: `supplier=${mapping.supplier} (${client.status}) is not auto-forwardable`,
      });
      continue;
    }

    if (!item.quantity || item.quantity <= 0) {
      unmapped.push({ itemId: item.id, title: item.title, reason: `Invalid quantity ${item.quantity}` });
      continue;
    }

    // Only forward the SKU when it's already in the supplier's expected shape
    // (e.g. AE "14:175;5:100"); otherwise let the supplier pick the default.
    const sku = item.variant?.sku;
    const shapedSku = sku && /^\d+:\d+(;\d+:\d+)*$/.test(sku) ? sku : undefined;

    let group = groupsBySupplier.get(mapping.supplier);
    if (!group) {
      group = { supplier: mapping.supplier, items: [], storeId: mapping.store_id };
      groupsBySupplier.set(mapping.supplier, group);
    }
    group.items.push({
      externalId: mapping.external_id,
      quantity: item.quantity,
      ...(shapedSku ? { skuAttr: shapedSku } : {}),
    });
  }

  return { groups: Array.from(groupsBySupplier.values()), unmapped };
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

/** Attribution values shared by every leg of one order. */
interface AttributionColumns {
  attributionJson: string | null;
  sessionId: string | null;
  eventId: string | null;
}

// Retry supplier placeOrder on 5xx and network errors.
// placeOrder must never throw for application errors — it returns
// { success: false, error }. We promote transient failures to thrown errors
// so retry() can catch and back-off them.
const isTransientSupplierError = (errMsg: string | undefined): boolean =>
  /HTTP\s+5\d\d|network|timeout|abort|fetch|econnreset|etimedout/i.test(errMsg ?? '');

/**
 * Forward ONE supplier's leg: dry-run inserts a `dry_run` row; live claims the
 * `(medusa_order_id, supplier)` lock (23505 handling), re-asserts the fail-closed
 * dropship-pur gate, and sends via the supplier client (or AutoDS when gated on).
 */
async function forwardSupplierGroup(
  medusaOrderId: string,
  group: SupplierGroup,
  address: SupplierAddress,
  opts: ForwardOptions,
  attr: AttributionColumns,
): Promise<ForwardLeg> {
  const db = getDb();
  const supplier = group.supplier;
  const payload: PlaceOrderInput = {
    outOrderId: medusaOrderId,
    address,
    items: group.items,
  };

  if (opts.dryRun) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_order_forwards
         (medusa_order_id, store_id, payload, status, dry_run,
          attribution_json, session_id, event_id, supplier)
       VALUES ($1, $2, $3, 'dry_run', true, $4, $5, $6, $7)
       RETURNING id`,
      [
        medusaOrderId,
        group.storeId ?? null,
        JSON.stringify(payload),
        attr.attributionJson,
        attr.sessionId,
        attr.eventId,
        supplier,
      ],
    );
    return { supplier, status: 'dry_run', forwardId: rows[0]!.id, payload };
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
        group.storeId ?? null,
        JSON.stringify(payload),
        attr.attributionJson,
        attr.sessionId,
        attr.eventId,
        supplier,
      ],
    );
    lockId = rows[0]!.id;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === '23505') {
      console.warn('[order-forwarder] live send already in-flight or completed', { medusaOrderId, supplier });
      return {
        supplier,
        status: 'error',
        forwardId: '',
        payload,
        error: 'Another live forward is already in-flight or completed for this order.',
      };
    }
    throw e;
  }

  // Fail-closed guard: re-assert the supplier is auto-forwardable immediately
  // before we send (catches any runtime state mismatch).
  const client = getSupplier(supplier);
  try {
    assertDropshipPure(client);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'assertDropshipPure failed';
    console.error('[order-forwarder] assertDropshipPure rejected', { medusaOrderId, supplier, error: errMsg });
    await db.query(
      `UPDATE dropship_order_forwards
          SET response = $1, status = 'error', error_message = $2
        WHERE id = $3`,
      [null, errMsg, lockId],
    );
    return { supplier, status: 'error', forwardId: lockId, payload, error: errMsg };
  }

  // ---------------------------------------------------------------------------
  // AutoDS routing gate (default OFF — set AUTODS_ROUTING_ENABLED=1 to enable)
  // ---------------------------------------------------------------------------
  // When enabled, the order is routed through AutoDS automation layer instead
  // of being dispatched directly to the supplier. The underlying supplier must
  // still pass the dropship-pur policy gate (assertDropshipPure above); AutoDS
  // is transport only, not a policy exemption.
  if (process.env.AUTODS_ROUTING_ENABLED === '1') {
    // assertDropshipPure already passed above — AutoDS is transport only, not a policy exemption.
    const autodsResult = await routeOrderViaAutoDS({
      outOrderId: medusaOrderId,
      underlyingSupplier: supplier,
      address: payload.address,
      items: payload.items,
    });
    if (autodsResult.success) {
      // The AutoDS order id is NOT an AliExpress order number — it must never be
      // written into ae_order_id (it breaks aliExpressOrderUrl + the AE stranded
      // scan). Persist supplier + supplier_order_id only; leave ae_order_id NULL.
      await db.query(
        `UPDATE dropship_order_forwards
            SET supplier_order_id = $1, response = $2, status = 'sent'
          WHERE id = $3`,
        [autodsResult.autodsOrderId ?? null, JSON.stringify(autodsResult.raw), lockId],
      );
      return {
        supplier,
        status: 'sent',
        forwardId: lockId,
        supplierOrderId: autodsResult.autodsOrderId,
        payload,
      };
    }
    // AutoDS failure — persist the error.
    console.error('[order-forwarder] AutoDS routing failed', { medusaOrderId, supplier, error: autodsResult.error });
    await db.query(
      `UPDATE dropship_order_forwards
          SET response = $1, status = 'error', error_message = $2
        WHERE id = $3`,
      [JSON.stringify(autodsResult.raw), autodsResult.error ?? 'AutoDS unknown error', lockId],
    );
    return { supplier, status: 'error', forwardId: lockId, payload, error: autodsResult.error };
  }

  const res = await retry(
    async () => {
      const r = await client.placeOrder!(payload);
      if (!r.success && isTransientSupplierError(r.error)) {
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
      isRetryable: (e) => e instanceof Error && isTransientSupplierError(e.message),
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
    const aeOrderId = supplier === 'aliexpress' ? (res.supplierOrderId ?? null) : null;
    await db.query(
      `UPDATE dropship_order_forwards
          SET supplier_order_id = $1, ae_order_id = $2, response = $3, status = 'sent'
        WHERE id = $4`,
      [res.supplierOrderId ?? null, aeOrderId, JSON.stringify(res.raw), lockId],
    );
    return { supplier, status: 'sent', forwardId: lockId, supplierOrderId: res.supplierOrderId, payload };
  }

  console.error('[order-forwarder] supplier placeOrder failed', { medusaOrderId, supplier, error: res.error });
  await db.query(
    `UPDATE dropship_order_forwards
        SET response = $1, status = 'error', error_message = $2
      WHERE id = $3`,
    [JSON.stringify(res.raw), res.error ?? 'unknown error', lockId],
  );
  return { supplier, status: 'error', forwardId: lockId, payload, error: res.error };
}

/**
 * Forward a single Medusa order. Persists each supplier leg — dry-run or live —
 * as its OWN row in `dropship_order_forwards`. A mixed cart forwards EACH
 * distinct forwardable supplier's items; no forwardable leg is silently dropped.
 */
export async function forwardOrder(medusaOrderId: string, opts: ForwardOptions): Promise<ForwardResult> {
  const order = await medusa.getOrder(medusaOrderId);
  const { groups, unmapped } = await mapItemsToSupplier(order);
  const { address, missing } = buildSupplierAddress(order, opts.provinceOverride);

  // Hydrate attribution context. Caller-provided wins; otherwise we look
  // it up from the funnel log. Result may have any subset of fields —
  // unknown fields stay NULL in the insert.
  const attributionCtx = opts.attribution ?? (await loadAttributionForOrder(medusaOrderId));
  const attr: AttributionColumns = {
    attributionJson: attributionCtx.attribution ? JSON.stringify(attributionCtx.attribution) : null,
    sessionId: attributionCtx.session_id ?? null,
    eventId: attributionCtx.event_id ?? null,
  };

  const db = getDb();

  // Hard gates: nothing forwardable to ship, or a missing address. Record ONE
  // error row so the founder sees the failure in the admin/anomaly-watch views.
  const hardError =
    groups.length === 0
      ? `No mappable items (unmapped: ${unmapped.length})`
      : missing.length > 0
        ? `Missing required address fields: ${missing.join(', ')}`
        : null;

  if (hardError) {
    const firstSupplier = groups[0]?.supplier ?? 'aliexpress';
    const errorPayload: PlaceOrderInput = {
      outOrderId: medusaOrderId,
      address,
      items: groups.flatMap((g) => g.items),
    };
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_order_forwards
         (medusa_order_id, store_id, payload, status, error_message, dry_run,
          attribution_json, session_id, event_id, supplier)
       VALUES ($1, $2, $3, 'error', $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        medusaOrderId,
        groups[0]?.storeId ?? null,
        JSON.stringify(errorPayload),
        hardError,
        opts.dryRun,
        attr.attributionJson,
        attr.sessionId,
        attr.eventId,
        firstSupplier,
      ],
    );
    return {
      ok: false,
      partial: false,
      status: 'error',
      error: hardError,
      forwards: [
        { supplier: firstSupplier, status: 'error', forwardId: rows[0]!.id, payload: errorPayload, error: hardError },
      ],
      unmappedItems: unmapped,
    };
  }

  // Forward each supplier group as its own row, in parallel. Each group targets
  // a DISTINCT supplier (mapItemsToSupplier groups by supplier), and the only
  // lock is the DB unique partial index on (medusa_order_id, supplier) — it is
  // per-supplier, so two groups never contend for the same lock. There is no
  // shared mutable JS state across the loop body, so full parallelism is safe.
  const forwards: ForwardLeg[] = await Promise.all(
    groups.map((group) => forwardSupplierGroup(medusaOrderId, group, address, opts, attr)),
  );

  const allSent = forwards.every((f) => f.status === 'sent');
  const allDryRun = forwards.every((f) => f.status === 'dry_run');
  const aggregateStatus: ForwardResult['status'] = allSent ? 'sent' : allDryRun ? 'dry_run' : 'error';
  const firstError = forwards.find((f) => f.status === 'error')?.error;
  // Partial = a mixed outcome where at least one supplier order was really
  // placed but another leg failed (e.g. {AE:sent, CJ:error}). Distinct from a
  // total failure — the route must treat it as a 200, not a 422.
  const partial =
    forwards.some((f) => f.status === 'sent') && forwards.some((f) => f.status === 'error');

  return {
    ok: forwards.every((f) => f.status !== 'error'),
    partial,
    status: aggregateStatus,
    error: firstError,
    forwards,
    unmappedItems: unmapped,
  };
}

// Re-export for legacy readers that build AE deep-links.
export { aliExpressOrderUrl };
