import { DS } from '@/lib/design/css-vars';

interface Offer {
  title: string;
  body: string;
}

interface SmartOfferStackProps {
  offers: Offer[];
  title?: string;
}

export function SmartOfferStack({ offers, title }: SmartOfferStackProps) {
  if (offers.length === 0) return null;

  return (
    <section className="border-y py-16 sm:py-24" style={{ borderColor: DS.border, backgroundColor: DS.surface }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {title && (
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--ds-font-display)' }}>
            {title}
          </h2>
        )}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {offers.slice(0, 3).map((point, i) => (
            <div
              key={i}
              className="rounded-2xl border p-6 sm:p-8"
              style={{ borderColor: DS.border, backgroundColor: 'var(--ds-bg)' }}
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: DS.accent }}>
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="text-lg font-semibold tracking-tight">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ds-text-muted)' }}>
                {point.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
