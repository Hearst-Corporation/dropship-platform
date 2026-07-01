// Shared supplier contract. Single source of truth for the normalized product
// shape + the SupplierClient interface + the mandatory dropshipping-pur manifest.

export type SupplierTier = 'v1' | 'v2';
export type SupplierStatus = 'active' | 'search_only' | 'feed-only' | 'automation' | 'excluded';

/** The eight mandatory-criteria flags from the NO-STOCK dropshipping spec. */
export interface SupplierCapabilities {
  unitOrder: boolean;        // no MOQ — a single unit can be ordered
  noStock: boolean;          // supplier paid only after the customer sale
  directShip: boolean;       // ships directly to the end customer
  neutralPackaging: boolean; // white-label / no supplier branding in the box
  stockPriceSync: boolean;   // live stock + price feed/API
  tracking: boolean;         // tracking number available
  returns: boolean;          // returns / dispute handling
  imageRights: boolean;      // licensed to reuse product imagery
}

/** Normalized product shape every supplier search returns. price is EUR (major units). */
export interface RawProduct {
  supplier: string;          // registry id
  externalId: string;
  title: string;
  price: number;             // EUR, major units
  imageUrl: string;
  supplierUrl: string;
  orders?: number;           // supplier signal (AE 30-day orders)
  evaluateRate?: string;     // supplier signal (AE rating)
  weightGrams?: number;
}

export interface SupplierSearchParams {
  keywords: string;
  page?: number;
  pageSize?: number;
  currency?: string;         // AE
  countryCode?: string;      // AE
  locale?: string;           // AE
  categoryId?: string;       // CJ
}

export interface SupplierSearchResult {
  success: boolean;
  products: RawProduct[];
  total?: number;
  error?: string;
  needsAuth?: boolean;       // mirrors AE OAuth-missing signal
}

/** Supplier-neutral shipping address (superset of AE logistics_address). */
export interface SupplierAddress {
  fullName: string;
  contactPerson: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  countryCode: string;       // ISO-2, uppercase
  zip: string;
  phoneDial: string;         // dial code without '+'
  phoneNumber: string;
}

export interface SupplierOrderItem {
  externalId: string;
  quantity: number;
  skuAttr?: string;          // AE "14:175;5:100"; ignored by others
}

export interface PlaceOrderInput {
  outOrderId: string;        // our medusa_order_id, for idempotency
  address: SupplierAddress;
  items: SupplierOrderItem[];
}

export interface PlaceOrderResult {
  success: boolean;
  supplierOrderId?: string;  // persisted to dropship_order_forwards.supplier_order_id
  raw: unknown;
  error?: string;
}

export interface TrackingResult {
  success: boolean;
  status?: string;
  trackingNumber?: string;
  carrier?: string;
  raw: unknown;
  error?: string;
}

export interface SupplierClient {
  readonly id: string;
  readonly label: string;
  readonly tier: SupplierTier;
  readonly status: SupplierStatus;
  readonly capabilities: SupplierCapabilities;
  searchProducts(params: SupplierSearchParams): Promise<SupplierSearchResult>;
  placeOrder?(input: PlaceOrderInput): Promise<PlaceOrderResult>;
  getTracking?(supplierOrderId: string): Promise<TrackingResult>;
  ensureAuth?(): Promise<boolean>;
}
