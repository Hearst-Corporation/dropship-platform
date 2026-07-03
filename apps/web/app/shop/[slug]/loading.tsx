/**
 * Route-level loading state for /shop/[slug]. Mirrors the generic storefront
 * anatomy (hero + product grid) with a pulse skeleton so navigation between
 * stores never flashes a blank page while data fetches.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <section
        className="py-20 text-center"
        style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
      >
        <div className="mx-auto max-w-3xl px-4">
          <div
            className="mx-auto mb-5 size-14 rounded-full"
            style={{ backgroundColor: 'var(--ct-surface-3, rgba(255,255,255,0.10))' }}
          />
          <div
            className="mx-auto mb-3 h-9 w-64 rounded-lg"
            style={{ backgroundColor: 'var(--ct-surface-3, rgba(255,255,255,0.10))' }}
          />
          <div
            className="mx-auto h-5 w-48 rounded-lg"
            style={{ backgroundColor: 'var(--ct-surface-3, rgba(255,255,255,0.10))' }}
          />
        </div>
      </section>

      {/* Product grid skeleton */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div
          className="mb-8 h-7 w-40 rounded-lg"
          style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: 'var(--ct-border, rgba(255,255,255,0.10))' }}
            >
              <div
                className="aspect-square"
                style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
              />
              <div className="space-y-3 p-4">
                <div
                  className="h-4 w-3/4 rounded"
                  style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
                />
                <div
                  className="h-5 w-1/3 rounded"
                  style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
                />
                <div
                  className="h-9 w-full rounded-lg"
                  style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
