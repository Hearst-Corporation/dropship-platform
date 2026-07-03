import { describe, it, expect } from "vitest";
import {
  formatMoney,
  formatNumberFr,
  formatEur,
  formatEurFromCents,
  formatEurCurrency,
  formatEurCurrencyCents,
  formatEurCurrencyPrecise,
  formatPercent,
  formatShortDate,
  formatLongDate,
  formatLongDateTime,
  formatDateTime,
  formatShortDateTime,
} from "./format";

// French locale uses a NARROW NO-BREAK SPACE (U+202F) as the thousands
// separator and before currency/percent glyphs in modern ICU. Normalise both
// it and the regular no-break space to a plain space so assertions read
// naturally and don't hinge on the exact separator codepoint.
const norm = (s: string) => s.replace(/[  ]/g, " ");

describe("formatMoney (re-exported from medusa-store)", () => {
  it("formats a major-unit EUR amount with the currency glyph", () => {
    expect(norm(formatMoney(9.99, "eur"))).toBe("9,99 €");
  });
  it("returns an empty string for nullish/NaN", () => {
    expect(formatMoney(null, "eur")).toBe("");
    expect(formatMoney(undefined, "eur")).toBe("");
    expect(formatMoney(NaN, "eur")).toBe("");
  });
});

describe("formatNumberFr", () => {
  it("formats with up to 2 decimals, no unit", () => {
    expect(norm(formatNumberFr(1234.5))).toBe("1 234,5");
    expect(formatNumberFr(2)).toBe("2");
    expect(formatNumberFr(2.456)).toBe("2,46");
  });
});

describe("formatEur", () => {
  it("suffixes a plain number with € (up to 2 decimals)", () => {
    expect(norm(formatEur(12))).toBe("12 €");
    expect(norm(formatEur(12.5))).toBe("12,5 €");
    expect(norm(formatEur(12.999))).toBe("13 €");
  });
});

describe("formatEurFromCents", () => {
  it("divides by 100 and suffixes € (0–2 decimals)", () => {
    expect(norm(formatEurFromCents(999))).toBe("9,99 €");
    expect(norm(formatEurFromCents(1000))).toBe("10 €");
    expect(norm(formatEurFromCents(0))).toBe("0 €");
  });
});

describe("Intl currency EUR variants", () => {
  it("formatEurCurrency rounds to whole euros", () => {
    expect(norm(formatEurCurrency(12.4))).toBe("12 €");
  });
  it("formatEurCurrencyCents keeps exactly 2 decimals", () => {
    expect(norm(formatEurCurrencyCents(12))).toBe("12,00 €");
    expect(norm(formatEurCurrencyCents(12.3))).toBe("12,30 €");
  });
  it("formatEurCurrencyPrecise keeps 2–4 decimals", () => {
    expect(norm(formatEurCurrencyPrecise(0.0012))).toBe("0,0012 €");
    expect(norm(formatEurCurrencyPrecise(1))).toBe("1,00 €");
  });
});

describe("formatPercent", () => {
  it("defaults to 1 decimal with a trailing %", () => {
    expect(norm(formatPercent(3.14))).toBe("3,1 %");
    expect(norm(formatPercent(5))).toBe("5,0 %");
  });
  it("honours a custom decimals count", () => {
    expect(norm(formatPercent(3.14159, { decimals: 2 }))).toBe("3,14 %");
    expect(norm(formatPercent(50, { decimals: 0 }))).toBe("50 %");
  });
  it("prefixes + for non-negative when signed", () => {
    expect(norm(formatPercent(2.5, { signed: true }))).toBe("+2,5 %");
    expect(norm(formatPercent(0, { signed: true }))).toBe("+0,0 %");
  });
  it("keeps the native minus for negatives when signed", () => {
    expect(norm(formatPercent(-2.5, { signed: true }))).toBe("-2,5 %");
  });
});

describe("formatShortDate", () => {
  it("formats an ISO date as JJ mois AAAA", () => {
    expect(formatShortDate("2026-07-03T10:00:00Z")).toContain("2026");
    expect(formatShortDate("2026-07-03T10:00:00Z")).toContain("juil.");
  });
  it("returns null for missing or invalid input", () => {
    expect(formatShortDate(undefined)).toBeNull();
    expect(formatShortDate(null)).toBeNull();
    expect(formatShortDate("")).toBeNull();
    expect(formatShortDate("not-a-date")).toBeNull();
  });
});

describe("formatLongDate", () => {
  it("uses the full month name", () => {
    expect(formatLongDate("2026-07-03T10:00:00Z")).toContain("juillet");
    expect(formatLongDate("2026-07-03T10:00:00Z")).toContain("2026");
  });
});

describe("formatLongDateTime", () => {
  it("includes month name and a HH:MM time", () => {
    const out = formatLongDateTime("2026-07-03T14:05:00Z");
    expect(out).toContain("juillet");
    expect(out).toMatch(/\d{2}:\d{2}/);
  });
});

describe("formatDateTime", () => {
  it("accepts an ISO string, a Date and epoch ms", () => {
    const iso = "2026-07-03T14:05:00Z";
    const fromIso = formatDateTime(iso);
    const fromDate = formatDateTime(new Date(iso));
    const fromMs = formatDateTime(new Date(iso).getTime());
    expect(fromIso).toBe(fromDate);
    expect(fromIso).toBe(fromMs);
    expect(fromIso).toMatch(/\d{2}:\d{2}/);
    expect(fromIso).toContain("2026");
  });
});

describe("formatShortDateTime", () => {
  it("is numeric with no year and a HH:MM time", () => {
    const out = formatShortDateTime("2026-07-03T14:05:00Z");
    expect(out).not.toContain("2026");
    expect(out).toMatch(/\d{2}\/\d{2}/);
    expect(out).toMatch(/\d{2}:\d{2}/);
  });
});
