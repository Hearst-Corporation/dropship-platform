/**
 * Route-level loading state for /cart. Mirrors the cart table anatomy
 * (title, line-item rows, summary block) with a pulse skeleton.
 */
export default function Loading() {
  return (
    <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 py-14 sm:py-20 animate-pulse">
      <div
        className="mb-12 h-9 w-40 rounded-lg"
        style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
      />
      <div
        className="rounded-2xl overflow-hidden border"
        style={{ borderColor: 'var(--ct-border, rgba(255,255,255,0.10))' }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-5 p-6"
            style={{
              borderTop: i > 0 ? '1px solid var(--ct-border-soft, rgba(255,255,255,0.06))' : undefined,
            }}
          >
            <div
              className="w-20 h-20 rounded-lg shrink-0"
              style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
            />
            <div className="flex-1 space-y-3">
              <div
                className="h-4 w-1/2 rounded"
                style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
              />
              <div
                className="h-3 w-1/4 rounded"
                style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
              />
            </div>
            <div
              className="h-10 w-28 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-col gap-3 max-w-md ml-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-5 w-full rounded"
            style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
          />
        ))}
      </div>
      <div className="mt-12 flex justify-end">
        <div
          className="h-14 w-56 rounded-full"
          style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
        />
      </div>
    </section>
  );
}
