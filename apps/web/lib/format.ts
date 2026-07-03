/**
 * Shared, canonical formatters for the French admin UI (`fr-FR` locale).
 *
 * Single source of truth for money / number / date / percent rendering so the
 * ~7 per-file reimplementations don't drift. Two money conventions coexist and
 * are BOTH intentional — don't collapse them:
 *
 * - **`formatMoney`** (re-exported from `medusa-store`) — `Intl` *currency*
 *   style, drives Medusa catalog prices that carry an explicit currency code.
 * - **`formatEur`** — plain number + `" €"` suffix, the house style for the
 *   dashboard / campaign KPIs where the currency is always EUR and the design
 *   wants a lighter glyph than the `Intl` currency symbol placement.
 *
 * Precision differences are exposed as named helpers rather than a single
 * "smart" one, because each call site relies on an exact number of decimals.
 */

// Re-export the Medusa currency formatter so callers have ONE import surface
// for money. It formats an amount already in major units with an ISO currency
// code via `Intl.NumberFormat(..., { style: 'currency' })`.
export { formatMoney } from "./medusa-store";

// ── Numbers ─────────────────────────────────────────────────────────────────

/** Plain French number, up to 2 decimals, no unit. e.g. `1 234,5`. */
export function formatNumberFr(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

// ── Money (EUR suffix convention) ─────────────────────────────────────────────

/** EUR amount as a plain number + `" €"` suffix, up to 2 decimals. */
export function formatEur(n: number): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
}

/** EUR amount from an integer number of **cents**, `" €"` suffix, 0–2 decimals. */
export function formatEurFromCents(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} €`;
}

/** EUR via `Intl` currency style, rounded to whole euros (no decimals). */
export function formatEurCurrency(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** EUR via `Intl` currency style, exactly 2 decimals. */
export function formatEurCurrencyCents(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** EUR via `Intl` currency style, 2–4 decimals (sub-cent AI costs). */
export function formatEurCurrencyPrecise(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

// ── Percent ───────────────────────────────────────────────────────────────────

/**
 * Percentage with a fixed number of decimals and a trailing `" %"`.
 * `signed` prefixes a `+` for non-negative values (delta display).
 */
export function formatPercent(
  n: number,
  { decimals = 1, signed = false }: { decimals?: number; signed?: boolean } = {},
): string {
  const sign = signed && n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} %`;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * Short French date `JJ mois AAAA` (e.g. `03 juil. 2026`).
 * Returns `null` on a missing or invalid input so callers can branch.
 */
export function formatShortDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return SHORT_DATE.format(d);
}

const LONG_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Long French date `J mois AAAA` (e.g. `3 juillet 2026`). */
export function formatLongDate(iso: string): string {
  return LONG_DATE.format(new Date(iso));
}

const LONG_DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Long French date + time (e.g. `3 juillet 2026, 14:05`). */
export function formatLongDateTime(iso: string): string {
  return LONG_DATE_TIME.format(new Date(iso));
}

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Short date + time `JJ mois AAAA, HH:MM` from an ISO string, a Date or epoch ms. */
export function formatDateTime(d: string | number | Date): string {
  return DATE_TIME.format(new Date(d));
}

const NUMERIC_DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Compact numeric date + time `JJ/MM HH:MM` (no year) from an ISO string. */
export function formatShortDateTime(d: string | number | Date): string {
  return NUMERIC_DATE_TIME.format(new Date(d));
}
