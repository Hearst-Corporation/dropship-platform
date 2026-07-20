import { Hero, ProblemSolution, Benefits, Proof, Objections, FinalCTA } from '@/components/storefront/blocks';
import type { StorefrontTemplateProps } from '../template-data';

/**
 * beauty-wellness-no-claims — soft, image-led, NO spec sheet, NO comparison
 * table. Order: full-bleed overlay hero → problem/solution → benefits →
 * lifestyle-heavy proof → objections → CTA. Compliance-first: no health,
 * medical or therapeutic claims (copy is scrubbed upstream + by the publish
 * gate); the structure leans on lifestyle and reassurance, not specs.
 */
export function BeautyWellness({ data }: StorefrontTemplateProps) {
  const d = data;
  const [b0, ...rest] = d.benefits;
  return (
    <>
      <Hero
        variant="overlay"
        {...d.hero}
        imageUrl={d.lifestyleImages[0] || d.heroImageUrl}
        ctaLabel="Découvrir"
        ctaHref={d.ctaHref}
      />
      {b0 && (
        <ProblemSolution
          kicker="La différence"
          problem="Une routine compliquée, des gestes en trop."
          solution={b0.body || b0.title}
          imageUrl={d.lifestyleImages[1] || d.productImageUrl}
        />
      )}
      <Benefits kicker="Les essentiels" title="Une routine simple, soignée" items={rest.length ? rest : d.benefits} />
      <Proof
        kicker="Confiance"
        title="Adopté au quotidien"
        promises={d.promises}
        lifestyleImages={d.lifestyleImages}
      />
      <Objections
        title="Ce que vous vous demandez"
        items={[
          { q: 'Est-ce simple à utiliser ?', a: 'Oui — pensé pour un usage quotidien sans effort.' },
          { q: 'Convient-il à mon usage ?', a: 'Conçu pour un usage lifestyle, sobre et polyvalent.' },
          { q: 'Et si ça ne me convient pas ?', a: 'Retours acceptés sous 30 jours, sans discussion.' },
        ]}
      />
      <FinalCTA
        headline={d.finalCta.headline}
        lede={d.finalCta.lede}
        ctaLabel={`Commander · ${d.priceLabel}`}
        ctaHref="/cart"
        note="Livraison suivie · Retours 30 jours"
      />
    </>
  );
}
