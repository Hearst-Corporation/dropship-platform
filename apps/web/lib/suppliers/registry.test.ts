import { describe, it, expect } from 'vitest';
import {
  SUPPLIERS,
  SUPPLIER_IDS,
  SupplierIdSchema,
  isSupplierId,
} from './registry';
import { isExcludedPlatform } from './policy';
import type { SupplierStatus, SupplierTier } from './types';

const VALID_TIERS: SupplierTier[] = ['v1', 'v2'];
const VALID_STATUSES: SupplierStatus[] = ['active', 'search_only', 'feed-only', 'automation', 'excluded'];
const CAPABILITY_KEYS = [
  'unitOrder',
  'noStock',
  'directShip',
  'neutralPackaging',
  'stockPriceSync',
  'tracking',
  'returns',
  'imageRights',
] as const;

describe('SUPPLIERS registry', () => {
  for (const id of SUPPLIER_IDS) {
    describe(`supplier: ${id}`, () => {
      const s = SUPPLIERS[id];

      it('client id matches registry key', () => {
        expect(s.id).toBe(id);
      });

      it('tier is valid', () => {
        expect(VALID_TIERS).toContain(s.tier);
      });

      it('status is valid', () => {
        expect(VALID_STATUSES).toContain(s.status);
      });

      it('all 8 capability keys are present and boolean', () => {
        for (const key of CAPABILITY_KEYS) {
          expect(typeof s.capabilities[key]).toBe('boolean');
        }
      });

      it('active supplier must have placeOrder', () => {
        if (s.status === 'active') {
          expect(typeof s.placeOrder).toBe('function');
        }
      });

      it('search_only and feed-only must NOT have placeOrder', () => {
        if (s.status === 'search_only' || s.status === 'feed-only') {
          expect(s.placeOrder).toBeUndefined();
        }
      });
    });
  }

  it('no supplier id is an excluded platform', () => {
    for (const id of SUPPLIER_IDS) {
      expect(isExcludedPlatform(id)).toBe(false);
    }
  });

  it('SupplierIdSchema parses known id', () => {
    expect(SupplierIdSchema.parse('aliexpress')).toBe('aliexpress');
  });

  it('SupplierIdSchema rejects unknown id', () => {
    expect(SupplierIdSchema.safeParse('nope').success).toBe(false);
  });

  it('isSupplierId returns true for known ids', () => {
    for (const id of SUPPLIER_IDS) {
      expect(isSupplierId(id)).toBe(true);
    }
  });

  it('isSupplierId returns false for unknown ids', () => {
    expect(isSupplierId('alibaba')).toBe(false);
    expect(isSupplierId('')).toBe(false);
  });
});
