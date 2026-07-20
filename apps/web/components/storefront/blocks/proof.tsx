import Image from 'next/image';
import { Section, Eyebrow, Headline } from './shared';

/** Social proof / trust promises + optional rating & lifestyle strip. */
export interface ProofProps {
  kicker?: string;
  title?: string;
  ratingLabel?: string;
  ordersLabel?: string;
  promises: Array<{ title: string; body: string }>;
  lifestyleImages?: string[];
}
export function Proof({
  kicker,
  title = 'Commander en confiance',
  ratingLabel,
  ordersLabel,
  promises,
  lifestyleImages = [],
}: ProofProps) {
  const hasPromises = promises?.length > 0;
  if (!hasPromises && lifestyleImages.length === 0) return null;
  return (
    <Section tint="muted">
      {kicker && <Eyebrow>{kicker}</Eyebrow>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Headline>{title}</Headline>
        {(ratingLabel || ordersLabel) && (
          <div className="flex items-center gap-6 text-sm">
            {ratingLabel && (
              <span className="font-semibold text-zinc-950">
                <span className="text-accent-600">★</span> {ratingLabel}
              </span>
            )}
            {ordersLabel && <span className="text-zinc-500">{ordersLabel}</span>}
          </div>
        )}
      </div>

      {lifestyleImages.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {lifestyleImages.slice(0, 3).map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-zinc-950/5">
              <Image src={src} alt="" fill sizes="(min-width:640px) 30vw, 50vw" className="object-cover" />
            </div>
          ))}
        </div>
      )}

      {hasPromises && (
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {promises.map((p, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-950">{p.title}</h3>
              <p className="mt-1.5 text-sm/relaxed text-zinc-600">{p.body}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
