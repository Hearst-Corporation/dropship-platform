import { describe, it, expect, afterEach, vi } from 'vitest';
import { factoryLocalOnly, assertMedusaWriteAllowed, FactoryMedusaWriteError } from './factory-mode';

describe('factory-mode', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('factoryLocalOnly is false unless FACTORY_LOCAL_ONLY === "true"', () => {
    vi.stubEnv('FACTORY_LOCAL_ONLY', '');
    expect(factoryLocalOnly()).toBe(false);
    vi.stubEnv('FACTORY_LOCAL_ONLY', 'false');
    expect(factoryLocalOnly()).toBe(false);
    vi.stubEnv('FACTORY_LOCAL_ONLY', '1');
    expect(factoryLocalOnly()).toBe(false);
    vi.stubEnv('FACTORY_LOCAL_ONLY', 'true');
    expect(factoryLocalOnly()).toBe(true);
  });

  it('assertMedusaWriteAllowed throws (never silent) when factory mode is on', () => {
    vi.stubEnv('FACTORY_LOCAL_ONLY', 'true');
    expect(() => assertMedusaWriteAllowed('createSalesChannel')).toThrow(FactoryMedusaWriteError);
    expect(() => assertMedusaWriteAllowed('createProductWithChannel')).toThrow(/Medusa prod/i);
  });

  it('assertMedusaWriteAllowed is a no-op when factory mode is off', () => {
    vi.stubEnv('FACTORY_LOCAL_ONLY', 'false');
    expect(() => assertMedusaWriteAllowed('createSalesChannel')).not.toThrow();
  });
});
