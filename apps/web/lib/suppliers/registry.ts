import { z } from 'zod';
import type { RawProduct, SupplierClient, SupplierSearchParams } from './types';
import { evaluateDropshipPure, isExcludedPlatform } from './policy';
import { aliexpressClient } from './aliexpress';
import { cjClient } from './cj';
import { zendropClient } from './zendrop';
import { spocketClient } from './spocket';
import { synceeClient } from './syncee';
import { bigbuyClient } from './bigbuy';
import { wholesale2bClient } from './wholesale2b';
import { dobaClient } from './doba';
import { inventorySourceClient } from './inventory-source';

/**
 * THE registry. Adding a supplier = write its client file + add ONE line here
 * + add its MSW handler. Nothing else in lib/ or app/ changes.
 */
export const SUPPLIERS = {
  // v1 suppliers
  aliexpress: aliexpressClient,
  cj: cjClient,
  zendrop: zendropClient,
  spocket: spocketClient,
  syncee: synceeClient,
  // v2 suppliers
  bigbuy: bigbuyClient,
  'wholesale2b': wholesale2bClient,
  doba: dobaClient,
  'inventory-source': inventorySourceClient,
} as const satisfies Record<string, SupplierClient>;

export type SupplierId = keyof typeof SUPPLIERS;
export const SUPPLIER_IDS = Object.keys(SUPPLIERS) as [SupplierId, ...SupplierId[]];
export const SupplierIdSchema = z.enum(SUPPLIER_IDS);

/** `ai-generated` is provenance for Claude-invented rows — never a client. */
export type ProductSource = SupplierId | 'ai-generated';

// Defensive: an excluded platform must never be registered as a live supplier.
for (const id of SUPPLIER_IDS) {
  if (isExcludedPlatform(id)) throw new Error(`Registry misconfig: excluded platform "${id}" registered as supplier`);
}

export function getSupplier(id: SupplierId): SupplierClient {
  return SUPPLIERS[id];
}
export function isSupplierId(v: string): v is SupplierId {
  return v in SUPPLIERS;
}
export function listSuppliers(filter?: {
  tier?: SupplierClient['tier'];
  forwardable?: boolean;
  status?: SupplierClient['status'];
}): SupplierClient[] {
  return Object.values(SUPPLIERS).filter((s) => {
    if (filter?.tier && s.tier !== filter.tier) return false;
    if (filter?.status && s.status !== filter.status) return false;
    if (filter?.forwardable && typeof s.placeOrder !== 'function') return false;
    return true;
  });
}
/** Suppliers allowed as PRODUCT SOURCES (pass the dropship-pur criteria gate). */
export function activeSourcingSuppliers(): SupplierClient[] {
  return Object.values(SUPPLIERS).filter((s) => evaluateDropshipPure(s).ok);
}

/** Fan-out search helper — replaces hand-rolled Promise.allSettled blocks. */
export async function searchAllSuppliers(
  params: SupplierSearchParams,
  opts?: { only?: SupplierId[] },
): Promise<{ products: RawProduct[]; errors: string[] }> {
  const clients = (opts?.only ? opts.only.map(getSupplier) : activeSourcingSuppliers());
  const settled = await Promise.allSettled(clients.map((c) => c.searchProducts(params)));
  const products: RawProduct[] = [];
  const errors: string[] = [];
  settled.forEach((r, i) => {
    const id = clients[i]!.id;
    if (r.status === 'rejected') errors.push(`${id}: ${String(r.reason)}`);
    else if (!r.value.success) errors.push(`${id}: ${r.value.error ?? 'unknown'}`);
    else products.push(...r.value.products);
  });
  return { products, errors };
}
