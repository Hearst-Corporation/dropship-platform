import { DS } from '@/lib/design/css-vars';

interface Review {
  name: string;
  rating: number;
  body: string;
}

interface SmartReviewWallProps {
  reviews?: Review[];
  title?: string;
}

const FALLBACK_REVIEWS: Review[] = [
  {
    name: 'Marie L.',
    rating: 5,
    body: 'Produit conforme, livraison rapide. Je recommande.',
  },
  {
    name: 'Thomas D.',
    rating: 5,
    body: 'Excellent rapport qualité-prix, emballage soigné.',
  },
  {
    name: 'Sophie R.',
    rating: 4,
    body: 'Très satisfaite de mon achat, service client réactif.',
  },
];

export function SmartReviewWall({ reviews, title }: SmartReviewWallProps) {
  const items = reviews?.length ? reviews : FALLBACK_REVIEWS;

  return (
    <section className="border-y py-16 sm:py-24" style={{ borderColor: DS.border }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          className="mb-10 text-center text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--ds-font-display)' }}
        >
          {title ?? 'Avis clients'}
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r, i) => (
            <div
              key={i}
              className="rounded-2xl border p-6"
              style={{ borderColor: DS.border, backgroundColor: 'var(--ds-surface)' }}
            >
              <div className="mb-3 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <span key={j} style={{ color: j < r.rating ? DS.accent : 'var(--ds-border)' }}>
                    ★
                  </span>
                ))}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ds-text-muted)' }}>
                &ldquo;{r.body}&rdquo;
              </p>
              <p className="mt-4 text-xs font-medium" style={{ color: 'var(--ds-text)' }}>
                {r.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
