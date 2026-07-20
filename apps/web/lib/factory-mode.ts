/**
 * Factory local-only mode.
 *
 * When `FACTORY_LOCAL_ONLY=true`, the store-creation pipeline must NEVER write
 * to the (prod Railway) Medusa instance: no sales channels, no publishable
 * keys, no product imports. Stores and products live only in the isolated
 * GPU1 Postgres. The admin reads them straight from Postgres, so a store is
 * fully visible / QA-able without Medusa. Checkout is deferred (no channel).
 *
 * This is enforced in two places:
 *   1. store-creator skips the whole Medusa provisioning block (primary path).
 *   2. the Medusa client's write methods hard-throw if called anyway
 *      (belt-and-suspenders: no silent fallback to prod Medusa).
 */
export function factoryLocalOnly(): boolean {
  return process.env.FACTORY_LOCAL_ONLY === 'true';
}

/** Thrown when a Medusa write is attempted while FACTORY_LOCAL_ONLY is on. */
export class FactoryMedusaWriteError extends Error {
  constructor(op: string) {
    super(
      `FACTORY_LOCAL_ONLY: Medusa write "${op}" refusé. La factory ne touche jamais Medusa prod. ` +
        `Retire FACTORY_LOCAL_ONLY ou branche une instance Medusa isolée.`,
    );
    this.name = 'FactoryMedusaWriteError';
  }
}

/** Guard for Medusa client write methods. Throws (never silently proceeds). */
export function assertMedusaWriteAllowed(op: string): void {
  if (factoryLocalOnly()) throw new FactoryMedusaWriteError(op);
}
