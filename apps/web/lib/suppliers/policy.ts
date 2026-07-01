// Single source of truth for the NO-STOCK dropshipping model: the hard
// exclusion blocklist + the mandatory-criteria gate. Enforcement is PURE and
// fail-closed; it never depends on a DB round-trip.
import type { SupplierCapabilities, SupplierClient } from './types';

export type ExclusionReason = 'moq' | 'wholesale' | 'manual-sourcing' | 'no-fulfillment';

export interface ExcludedPlatform {
  id: string;
  label: string;
  reason: ExclusionReason;
  note: string; // admin-visible FR explanation
}

/** HARD BLOCKLIST — a platform here can never be registered as an active supplier. */
export const EXCLUDED_PLATFORMS: readonly ExcludedPlatform[] = [
  { id: 'alibaba',         label: 'Alibaba (classic)',          reason: 'moq',             note: 'MOQ eleve + achat de stock — modele grossiste, pas dropshipping unitaire.' },
  { id: '1688',            label: '1688',                       reason: 'wholesale',       note: 'Grossiste domestique CN, MOQ, pas de fulfillment direct au client final.' },
  { id: 'taobao',          label: 'Taobao',                     reason: 'no-fulfillment',  note: 'Marketplace C2C CN, pas d expedition neutre internationale ni API dropship.' },
  { id: 'indiamart',       label: 'IndiaMART',                  reason: 'manual-sourcing', note: 'Annuaire B2B, sourcing manuel, MOQ, aucun fulfillment automatise.' },
  { id: 'tradeindia',      label: 'TradeIndia',                 reason: 'manual-sourcing', note: 'Annuaire exportateurs, devis manuels, pas d API commande unitaire.' },
  { id: 'exportersindia',  label: 'ExportersIndia',             reason: 'manual-sourcing', note: 'Annuaire exportateurs, sourcing manuel, pas de dropship unitaire.' },
  { id: 'turkishexporter', label: 'TurkishExporter',            reason: 'wholesale',       note: 'Portail export B2B, MOQ / gros, pas de fulfillment direct.' },
  { id: 'made-in-china',   label: 'Made-in-China',              reason: 'wholesale',       note: 'Grossiste / usine, MOQ, achat de stock — hors modele no-stock.' },
  { id: 'local-no-api',    label: 'Fournisseur local sans API', reason: 'no-fulfillment',  note: 'Pas d API ni de fulfillment — impossible d automatiser / expedier en neutre.' },
] as const;

const EXCLUDED_IDS = new Set(EXCLUDED_PLATFORMS.map((p) => p.id));

export function isExcludedPlatform(id: string): boolean {
  return EXCLUDED_IDS.has(id.toLowerCase().trim());
}
export function exclusionFor(id: string): ExcludedPlatform | undefined {
  return EXCLUDED_PLATFORMS.find((p) => p.id === id.toLowerCase().trim());
}

const HARD_CRITERIA: (keyof SupplierCapabilities)[] = ['unitOrder', 'noStock', 'directShip'];
const SOFT_CRITERIA: (keyof SupplierCapabilities)[] = ['neutralPackaging', 'stockPriceSync', 'tracking', 'returns', 'imageRights'];

export interface DropshipVerdict {
  ok: boolean;
  blockedBy: string[];
  warnings: string[];
}

export function evaluateDropshipPure(s: Pick<SupplierClient, 'id' | 'status' | 'capabilities'>): DropshipVerdict {
  const blockedBy: string[] = [];
  const warnings: string[] = [];
  if (isExcludedPlatform(s.id)) blockedBy.push('excluded');
  if (s.status === 'automation') blockedBy.push('automation-not-a-supplier');
  if (s.status === 'excluded') blockedBy.push('excluded');
  for (const c of HARD_CRITERIA) if (!s.capabilities?.[c]) blockedBy.push(c);
  for (const c of SOFT_CRITERIA) if (!s.capabilities?.[c]) warnings.push(c);
  return { ok: blockedBy.length === 0, blockedBy, warnings };
}

/** Fail-closed guard: throws if the supplier may not join the active socle. */
export function assertDropshipPure(s: Pick<SupplierClient, 'id' | 'status' | 'capabilities'>): void {
  const v = evaluateDropshipPure(s);
  if (!v.ok) throw new Error(`Supplier "${s.id}" blocked from dropship-pur socle: ${v.blockedBy.join(', ')}`);
}

/** Feed-only / search-only suppliers may SOURCE products but must NOT be live-forwarded. */
export function canAutoForward(s: Pick<SupplierClient, 'status' | 'placeOrder'>): boolean {
  return s.status === 'active' && typeof s.placeOrder === 'function';
}
