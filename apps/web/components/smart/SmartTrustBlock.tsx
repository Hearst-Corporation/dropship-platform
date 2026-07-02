import { DS } from '@/lib/design/css-vars';

interface TrustItem {
  title: string;
  body: string;
}

interface SmartTrustBlockProps {
  items: TrustItem[];
}

export function SmartTrustBlock({ items }: SmartTrustBlockProps) {
  if (items.length === 0) return null;

  return (
    <section className="border-b py-10" style={{ borderColor: DS.border, backgroundColor: DS.surface }}>
      <h2 className="sr-only">Nos engagements</h2>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
        {items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="mb-1 h-0.5 w-8" style={{ backgroundColor: DS.accent }} />
            <h3 className="text-sm font-semibold uppercase tracking-wider">{item.title}</h3>
            <p className="text-sm" style={{ color: 'var(--ds-text-muted)' }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
