import { describe, it, expect } from 'vitest';
import {
  EXCLUDED_PLATFORMS,
  isExcludedPlatform,
  exclusionFor,
  evaluateDropshipPure,
  assertDropshipPure,
  canAutoForward,
} from './policy';
import type { SupplierCapabilities, SupplierClient } from './types';

const FULL_CAPABILITIES: SupplierCapabilities = {
  unitOrder: true,
  noStock: true,
  directShip: true,
  neutralPackaging: true,
  stockPriceSync: true,
  tracking: true,
  returns: true,
  imageRights: true,
};

const ACTIVE_FULL: Pick<SupplierClient, 'id' | 'status' | 'capabilities'> = {
  id: 'test-ok',
  status: 'active',
  capabilities: FULL_CAPABILITIES,
};

describe('isExcludedPlatform', () => {
  it('returns true for every id in EXCLUDED_PLATFORMS', () => {
    for (const p of EXCLUDED_PLATFORMS) {
      expect(isExcludedPlatform(p.id)).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(isExcludedPlatform('ALIBABA')).toBe(true);
    expect(isExcludedPlatform('Alibaba')).toBe(true);
  });

  it('returns false for unknown ids', () => {
    expect(isExcludedPlatform('aliexpress')).toBe(false);
    expect(isExcludedPlatform('cj')).toBe(false);
    expect(isExcludedPlatform('random-supplier')).toBe(false);
  });
});

describe('exclusionFor', () => {
  it('returns the ExcludedPlatform for known ids', () => {
    const result = exclusionFor('alibaba');
    expect(result).toBeDefined();
    expect(result?.id).toBe('alibaba');
  });

  it('returns undefined for unknown ids', () => {
    expect(exclusionFor('aliexpress')).toBeUndefined();
  });
});

describe('evaluateDropshipPure', () => {
  it('blocks a supplier whose id is in the excluded list', () => {
    const v = evaluateDropshipPure({
      id: 'alibaba',
      status: 'active',
      capabilities: FULL_CAPABILITIES,
    });
    expect(v.ok).toBe(false);
    expect(v.blockedBy).toContain('excluded');
  });

  it('blocks a supplier with automation status', () => {
    const v = evaluateDropshipPure({
      id: 'test-automation',
      status: 'automation',
      capabilities: FULL_CAPABILITIES,
    });
    expect(v.ok).toBe(false);
    expect(v.blockedBy).toContain('automation-not-a-supplier');
  });

  it('blocks a supplier with excluded status', () => {
    const v = evaluateDropshipPure({
      id: 'test-excl',
      status: 'excluded',
      capabilities: FULL_CAPABILITIES,
    });
    expect(v.ok).toBe(false);
    expect(v.blockedBy).toContain('excluded');
  });

  it('blocks when hard criteria are missing', () => {
    const v = evaluateDropshipPure({
      id: 'test-no-unit',
      status: 'active',
      capabilities: { ...FULL_CAPABILITIES, unitOrder: false, noStock: false },
    });
    expect(v.ok).toBe(false);
    expect(v.blockedBy).toContain('unitOrder');
    expect(v.blockedBy).toContain('noStock');
  });

  it('passes a fully capable active supplier', () => {
    const v = evaluateDropshipPure(ACTIVE_FULL);
    expect(v.ok).toBe(true);
    expect(v.blockedBy).toHaveLength(0);
  });

  it('emits warnings for missing soft criteria', () => {
    const v = evaluateDropshipPure({
      id: 'test-warn',
      status: 'active',
      capabilities: { ...FULL_CAPABILITIES, tracking: false, returns: false },
    });
    expect(v.ok).toBe(true);
    expect(v.warnings).toContain('tracking');
    expect(v.warnings).toContain('returns');
  });
});

describe('assertDropshipPure', () => {
  it('throws on blocked supplier', () => {
    expect(() =>
      assertDropshipPure({ id: 'alibaba', status: 'active', capabilities: FULL_CAPABILITIES }),
    ).toThrow();
  });

  it('does not throw on fully valid supplier', () => {
    expect(() => assertDropshipPure(ACTIVE_FULL)).not.toThrow();
  });
});

describe('canAutoForward', () => {
  it('returns true for active supplier with placeOrder', () => {
    const s = {
      status: 'active' as const,
      placeOrder: async () => ({ success: true, raw: null }),
    };
    expect(canAutoForward(s)).toBe(true);
  });

  it('returns false for search_only even with placeOrder somehow defined', () => {
    const s = {
      status: 'search_only' as const,
      placeOrder: async () => ({ success: true, raw: null }),
    };
    expect(canAutoForward(s)).toBe(false);
  });

  it('returns false for active supplier without placeOrder', () => {
    const s = { status: 'active' as const, placeOrder: undefined };
    expect(canAutoForward(s)).toBe(false);
  });
});
