/**
 * Route-level loading state for /checkout. Mirrors the two-column layout
 * (form + order summary) with a pulse skeleton.
 */
export default function Loading() {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10 animate-pulse">
      <div>
        <div
          className="mb-6 h-8 w-32 rounded-lg"
          style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
        />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full rounded-lg"
              style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
            />
          ))}
          <div
            className="h-14 w-full rounded-lg mt-6"
            style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
          />
        </div>
      </div>
      <aside
        className="rounded-lg p-6 h-fit space-y-4 border"
        style={{ borderColor: 'var(--ct-border, rgba(255,255,255,0.10))' }}
      >
        <div
          className="h-5 w-32 rounded"
          style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
        />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-full rounded"
            style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
          />
        ))}
      </aside>
    </section>
  );
}
