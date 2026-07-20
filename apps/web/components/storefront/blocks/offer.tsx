import { Section, Eyebrow, Headline, Lede, CtaButton } from './shared';

/** Offer / bundle card — price, what's included, CTA. */
export interface OfferProps {
  kicker?: string;
  title?: string;
  priceLabel: string;
  comparePriceLabel?: string;
  included: Array<{ qty: string; label: string }>;
  ctaLabel: string;
  ctaHref: string;
  note?: string;
}
export function Offer({
  kicker,
  title = 'Votre commande',
  priceLabel,
  comparePriceLabel,
  included,
  ctaLabel,
  ctaHref,
  note,
}: OfferProps) {
  return (
    <Section>
      <div className="mx-auto max-w-xl rounded-3xl border border-zinc-950/8 bg-white p-8 shadow-sm sm:p-10">
        {kicker && <Eyebrow>{kicker}</Eyebrow>}
        <Headline>{title}</Headline>
        <div className="mt-6 flex items-baseline gap-3">
          <span className="text-4xl font-semibold tracking-tight text-zinc-950">{priceLabel}</span>
          {comparePriceLabel && (
            <span className="text-lg text-zinc-400 line-through">{comparePriceLabel}</span>
          )}
        </div>
        {included?.length > 0 && (
          <ul className="mt-6 space-y-2.5">
            {included.map((it, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-zinc-700">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-700">
                  {it.qty}
                </span>
                {it.label}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8">
          <CtaButton href={ctaHref}>{ctaLabel}</CtaButton>
        </div>
        {note && <p className="mt-4 text-xs text-zinc-500">{note}</p>}
      </div>
    </Section>
  );
}

/** Final CTA band. */
export interface FinalCTAProps {
  kicker?: string;
  headline: string;
  lede?: string;
  ctaLabel: string;
  ctaHref: string;
  note?: string;
}
export function FinalCTA({ kicker, headline, lede, ctaLabel, ctaHref, note }: FinalCTAProps) {
  return (
    <Section tint="accent" className="text-center">
      <div className="mx-auto max-w-2xl">
        {kicker && <Eyebrow onDark>{kicker}</Eyebrow>}
        <Headline onDark>{headline}</Headline>
        {lede && <Lede onDark>{lede}</Lede>}
        <div className="mt-8 flex justify-center">
          <CtaButton href={ctaHref} onDark>
            {ctaLabel}
          </CtaButton>
        </div>
        {note && <p className="mt-4 text-sm text-white/70">{note}</p>}
      </div>
    </Section>
  );
}
