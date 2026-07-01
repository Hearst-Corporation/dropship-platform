/**
 * FX helpers for supplier price conversion.
 *
 * // CONFIRM: wire a live FX source; env override SUPPLIER_USD_EUR_RATE is
 * the interim control.
 *
 * Usage:
 *   import { usdToEur, USD_EUR_RATE } from './fx';
 *   const priceEur = usdToEur(priceUsd);
 *
 * The rate is resolved once per call from process.env.SUPPLIER_USD_EUR_RATE
 * (parseFloat). If the env var is absent or NaN the default of 0.92 is used.
 * Tests can override with vi.stubEnv('SUPPLIER_USD_EUR_RATE', '0.91').
 */

/** Default USD→EUR rate used when SUPPLIER_USD_EUR_RATE is not set. */
export const DEFAULT_USD_EUR_RATE = 0.92;

/**
 * Returns the resolved USD→EUR conversion rate.
 * Reads process.env.SUPPLIER_USD_EUR_RATE at call time so tests using
 * vi.stubEnv() are honoured without re-importing the module.
 */
export function getUsdEurRate(): number {
  const envVal = parseFloat(process.env.SUPPLIER_USD_EUR_RATE ?? '');
  return Number.isFinite(envVal) && envVal > 0 ? envVal : DEFAULT_USD_EUR_RATE;
}

/**
 * Convert a USD amount to EUR using the configured rate.
 *
 * @param usd - Amount in USD
 * @returns Amount in EUR (rounded to 4 decimal places to avoid float noise)
 */
export function usdToEur(usd: number): number {
  return usd * getUsdEurRate();
}
