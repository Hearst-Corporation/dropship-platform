/**
 * Shared Zod helpers.
 *
 * `z.enum()` requires a non-empty tuple type (`[string, ...string[]]`) at
 * the TYPE level, but our enum values usually come from a `readonly T[]`
 * built elsewhere (e.g. `TEMPLATE_IDS` in `template-catalog.ts`,
 * `ASSET_KINDS` in `asset-regenerator.ts`) — arrays whose length isn't known
 * to TypeScript at compile time. There is no way to convince the type
 * checker a runtime array is non-empty without an escape-hatch cast, so we
 * centralize that ONE cast here instead of repeating
 * `as unknown as [T, ...T[]]` at every call site.
 */

import { z } from 'zod';

/**
 * Build a `z.enum()` schema from a `readonly string[]` (or a readonly array
 * of any string-literal union type `T`) whose length isn't visible to the
 * type checker. Callers get back a properly typed enum schema that only
 * accepts `T` — the cast is contained inside this function, audited once.
 *
 * The return type is left to inference (rather than spelled out as
 * `z.ZodEnum<...>`) because Zod v4's enum type is a mapped object type
 * derived from the tuple, not a simple `ZodEnum<[T, ...T[]]>` — hand-writing
 * it drifts out of sync with what `z.enum()` actually returns and breaks
 * assignability at every call site.
 *
 * Throws at call time if `values` is empty, since `z.enum()` itself would
 * otherwise construct a schema that can never validate anything (and the
 * cast would be lying about the non-empty tuple type).
 */
export function zEnumFromReadonly<T extends string>(values: readonly T[]) {
  if (values.length === 0) {
    throw new Error('zEnumFromReadonly: values must be non-empty');
  }
  return z.enum(values as unknown as [T, ...T[]]);
}
