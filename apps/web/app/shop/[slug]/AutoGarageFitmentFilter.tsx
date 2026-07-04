'use client';

import { useState } from 'react';

/**
 * Vehicle fitment selector — cascading Marque / Modèle / Année UI.
 *
 * HONESTY NOTE (read before wiring real data):
 * Medusa products carry NO vehicle-compatibility metadata today (checked
 * `lib/medusa-store.ts` — `StoreProduct` has no `fitment`/`compatibility`
 * field, and no such column exists on `dropship_stores` or a Medusa product
 * metadata convention in this codebase). Faking a "12 produits compatibles"
 * result against a hardcoded make/model list would assert compatibility
 * claims about REAL products this platform cannot back up — a returns/safety
 * risk for an actual buyer (dash cam mounts, cable routing, etc. are often
 * vehicle-specific).
 *
 * So this component is intentionally PRESENTATIONAL rather than a mechanical
 * fake-data filter: the three selects are fully interactive (real state,
 * real cascading enable/disable), but making a selection never hides real
 * products — it only surfaces an honest disclaimer above the grid. This
 * matches the "engineering judgment" call: mechanical UI, no fabricated
 * data.
 *
 * What a REAL implementation needs:
 *   - A `fitment` JSON field on Medusa product metadata, e.g.
 *     `{ makes: ['Renault', 'Peugeot'], models: ['Clio V'], years: [2019, 2024] }`
 *     populated at import time (`lib/agent/store-creator.ts`) from supplier
 *     data when available, or curated manually per product.
 *   - This component would then actually filter `products` client-side (or
 *     the parent would refetch server-side) against the selected make/model/
 *     year instead of only rendering a disclaimer.
 */

const MAKES = ['Renault', 'Peugeot', 'Volkswagen', 'Toyota', 'BMW'] as const;

// Demo-only cascading data so the UI feels real while a selection is made.
// Not tied to actual catalog data — see honesty note above.
const MODELS_BY_MAKE: Record<(typeof MAKES)[number], string[]> = {
  Renault: ['Clio', 'Mégane', 'Captur'],
  Peugeot: ['208', '308', '3008'],
  Volkswagen: ['Golf', 'Polo', 'Tiguan'],
  Toyota: ['Yaris', 'Corolla', 'RAV4'],
  BMW: ['Série 1', 'Série 3', 'X1'],
};

const YEARS = Array.from({ length: 15 }, (_, i) => String(2026 - i));

export function AutoGarageFitmentFilter() {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  const hasSelection = Boolean(make || model || year);
  const models = make ? MODELS_BY_MAKE[make as (typeof MAKES)[number]] ?? [] : [];

  return (
    <div className="border border-white/10 bg-black/40 p-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
        Vérifier la compatibilité
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select
          aria-label="Marque du véhicule"
          value={make}
          onChange={(e) => {
            setMake(e.target.value);
            setModel('');
          }}
          className="border border-white/15 bg-black px-3 py-2 font-mono text-sm uppercase tracking-wide text-white focus:border-white/40 focus:outline-none"
        >
          <option value="">Marque</option>
          {MAKES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Modèle du véhicule"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!make}
          className="border border-white/15 bg-black px-3 py-2 font-mono text-sm uppercase tracking-wide text-white focus:border-white/40 focus:outline-none disabled:opacity-30"
        >
          <option value="">Modèle</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Année du véhicule"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={!make}
          className="border border-white/15 bg-black px-3 py-2 font-mono text-sm uppercase tracking-wide text-white focus:border-white/40 focus:outline-none disabled:opacity-30"
        >
          <option value="">Année</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {hasSelection && (
        <p className="mt-4 text-xs text-white/50">
          Compatible avec la plupart des véhicules — vérifiez les specs du
          produit avant commande.
        </p>
      )}
    </div>
  );
}
