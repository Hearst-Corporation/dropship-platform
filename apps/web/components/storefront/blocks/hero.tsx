import Image from 'next/image';
import { Eyebrow, CtaButton } from './shared';

export interface HeroProps {
  kicker?: string;
  /** May contain a single <em> for accent emphasis (from landing_content). */
  headlineHtml: string;
  lede?: string;
  imageUrl?: string | null;
  priceLabel?: string;
  ctaLabel: string;
  ctaHref: string;
  /** 'split' = image right (tech/premium), 'overlay' = full-bleed image behind. */
  variant?: 'split' | 'overlay';
}

export function Hero({
  kicker,
  headlineHtml,
  lede,
  imageUrl,
  priceLabel,
  ctaLabel,
  ctaHref,
  variant = 'split',
}: HeroProps) {
  if (variant === 'overlay' && imageUrl) {
    return (
      <section className="relative isolate w-full overflow-hidden bg-zinc-950 text-white">
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55"
        />
        <div className="mx-auto flex max-w-6xl flex-col items-start px-5 py-28 sm:px-8 sm:py-40">
          {kicker && <Eyebrow onDark>{kicker}</Eyebrow>}
          <h1
            className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl [&_em]:not-italic [&_em]:text-accent-300"
            dangerouslySetInnerHTML={{ __html: headlineHtml }}
          />
          {lede && <p className="mt-5 max-w-xl text-lg/relaxed text-zinc-200">{lede}</p>}
          <div className="mt-8 flex items-center gap-4">
            <CtaButton href={ctaHref} onDark>
              {ctaLabel}
            </CtaButton>
            {priceLabel && <span className="text-sm font-medium text-zinc-300">{priceLabel}</span>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div>
          {kicker && <Eyebrow>{kicker}</Eyebrow>}
          <h1
            className="text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl [&_em]:not-italic [&_em]:text-accent-600"
            dangerouslySetInnerHTML={{ __html: headlineHtml }}
          />
          {lede && <p className="mt-5 max-w-lg text-lg/relaxed text-zinc-600">{lede}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <CtaButton href={ctaHref}>{ctaLabel}</CtaButton>
            {priceLabel && <span className="text-sm font-medium text-zinc-500">{priceLabel}</span>}
          </div>
        </div>
        {imageUrl && (
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-zinc-100 ring-1 ring-zinc-950/5">
            <Image
              src={imageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </section>
  );
}
