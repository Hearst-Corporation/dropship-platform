import { Fragment } from 'react';
import {
  Hero,
  ProblemSolution,
  Benefits,
  Showcase,
  Specs,
  Comparison,
  Proof,
  Transformation,
  Objections,
  Reassurance,
  DEFAULT_REASSURANCE,
  Offer,
  Bundle,
  FAQ,
  FinalCTA,
  StickyCta,
} from '@/components/storefront/blocks';
import type { StorefrontData } from '@/lib/storefront/template-data';
import type { BlockSpec, ImageSlot, TemplateBlueprint } from '@/lib/storefront/inspiration/types';

/**
 * BlueprintRenderer — le SEUL endroit qui compose les blocs. Il lit un
 * TemplateBlueprint (ordre + réglages) et une StorefrontData (copie réelle
 * issue de landing_content, GPU1, sans Medusa) et produit la page. Aucun
 * template ne duplique de JSX : ils ne sont que des données (blueprint-templates.ts).
 *
 * Les blocs vides (pas de données) se rendent en null d'eux-mêmes — un blueprint
 * peut donc lister un bloc sans risque de cadre vide si la copie manque.
 */
export function BlueprintRenderer({ blueprint, data }: { blueprint: TemplateBlueprint; data: StorefrontData }) {
  const hasSticky = blueprint.blockOrder.some((b) => b.type === 'sticky_cta');
  return (
    <div className={hasSticky ? 'pb-20 sm:pb-0' : undefined}>
      {blueprint.blockOrder.map((spec, i) => (
        <Fragment key={`${spec.type}-${i}`}>{renderBlock(spec, data, blueprint)}</Fragment>
      ))}
    </div>
  );
}

/** Résout un slot d'image du blueprint contre les images réelles du store. */
function resolveImage(slot: ImageSlot | undefined, d: StorefrontData): string | null {
  switch (slot) {
    case 'hero':
      return d.heroImageUrl || d.productImageUrl || null;
    case 'product':
      return d.productImageUrl || d.heroImageUrl || null;
    case 'lifestyle0':
      return d.lifestyleImages[0] || d.heroImageUrl || null;
    case 'lifestyle1':
      return d.lifestyleImages[1] || d.productImageUrl || null;
    case 'lifestyle_grid':
      return d.lifestyleImages[0] || null;
    case 'none':
    case undefined:
    default:
      return null;
  }
}

function renderBlock(spec: BlockSpec, d: StorefrontData, bp: TemplateBlueprint) {
  const cta = { label: `Commander · ${d.priceLabel}`, href: d.ctaHref };

  switch (spec.type) {
    case 'hero':
      return (
        <Hero
          variant={(spec.variant as 'split' | 'overlay') ?? bp.heroStyle}
          kicker={d.hero.kicker}
          headlineHtml={d.hero.headlineHtml}
          lede={d.hero.lede}
          imageUrl={resolveImage(spec.imageSlot ?? 'hero', d)}
          priceLabel={d.hero.priceLabel}
          ctaLabel={spec.ctaLabel ?? cta.label}
          ctaHref={spec.ctaHref ?? cta.href}
        />
      );

    case 'problem_solution': {
      const first = d.benefits[0];
      if (!first) return null;
      return (
        <ProblemSolution
          kicker={spec.kicker}
          problem={spec.fallback?.problem ?? 'Le geste habituel, plus pénible qu’il ne devrait.'}
          solution={first.body || first.title}
          imageUrl={resolveImage(spec.imageSlot ?? 'product', d)}
        />
      );
    }

    case 'benefits':
      return <Benefits kicker={spec.kicker} title={spec.title} items={d.benefits} />;

    case 'showcase':
      return (
        <Showcase
          kicker={spec.kicker}
          title={spec.title ?? d.finalCta.headline}
          lede={spec.note}
          imageUrl={resolveImage(spec.imageSlot ?? 'product', d)}
          galleryImages={spec.imageSlot === 'lifestyle_grid' ? d.lifestyleImages : []}
          points={d.benefits.slice(0, 5).map((b) => b.title)}
          tone={spec.tone === 'dark' ? 'dark' : spec.tone === 'muted' ? 'muted' : 'plain'}
        />
      );

    case 'specs':
      return <Specs kicker={spec.kicker} title={spec.title} specs={d.specs} />;

    case 'comparison': {
      const rows = d.benefits.slice(0, 4).map((b) => ({ label: b.title, us: true, them: false }));
      if (rows.length === 0) return null;
      return <Comparison ours={d.store.name} theirs={spec.fallback?.comparisonTheirs ?? 'Générique'} rows={rows} />;
    }

    case 'proof':
      return (
        <Proof
          kicker={spec.kicker}
          title={spec.title}
          promises={d.promises}
          lifestyleImages={spec.imageSlot === 'lifestyle_grid' ? d.lifestyleImages : []}
          ratingLabel={d.ratingLabel}
          ordersLabel={d.ordersLabel}
        />
      );

    case 'transformation': {
      const [b0, b1] = d.benefits;
      if (!b0) return null;
      return (
        <Transformation
          kicker={spec.kicker}
          title={spec.title}
          beforeText={spec.fallback?.problem ?? 'Le quotidien, sans le produit.'}
          afterText={b1?.body || b0.body || b0.title}
          beforeImage={resolveImage('lifestyle0', d)}
          afterImage={resolveImage('product', d)}
        />
      );
    }

    case 'objections':
      return (
        <Objections
          title={spec.title}
          items={
            spec.fallback?.objections ?? [
              { q: 'Est-ce simple à utiliser ?', a: 'Oui — pensé pour un usage quotidien sans effort.' },
              { q: 'Convient-il à mon usage ?', a: 'Conçu pour un usage polyvalent et sobre.' },
              { q: 'Et si ça ne me convient pas ?', a: 'Retours acceptés sous 30 jours, sans discussion.' },
            ]
          }
        />
      );

    case 'reassurance':
      return (
        <Reassurance
          kicker={spec.kicker}
          tone={spec.tone === 'muted' ? 'muted' : 'plain'}
          items={
            d.promises.length
              ? d.promises.slice(0, 4).map((p) => ({ title: p.title, body: p.body }))
              : DEFAULT_REASSURANCE
          }
        />
      );

    case 'offer':
      return (
        <Offer
          kicker={spec.kicker}
          title={spec.title}
          priceLabel={d.priceLabel}
          included={d.included.length ? d.included : [{ qty: '1', label: d.product?.title ?? 'Le produit' }]}
          ctaLabel={spec.ctaLabel ?? 'Ajouter au panier'}
          ctaHref={spec.ctaHref ?? '/cart'}
          note={spec.note}
        />
      );

    case 'bundle':
      return (
        <Bundle
          kicker={spec.kicker}
          title={spec.title}
          products={d.products.map((p) => ({
            title: p.title,
            priceLabel: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(p.priceCents / 100),
            imageUrl: p.imageUrl,
          }))}
          ctaLabel={spec.ctaLabel ?? 'Composer mon pack'}
          ctaHref={spec.ctaHref ?? '/cart'}
          note={spec.note}
        />
      );

    case 'faq':
      return (
        <FAQ
          title={spec.title}
          items={
            spec.fallback?.faq ?? [
              { q: 'Quels sont les délais de livraison ?', a: 'Commande traitée sous 24 h, livraison suivie.' },
              { q: 'Puis-je retourner le produit ?', a: 'Oui, retours acceptés sous 30 jours.' },
            ]
          }
        />
      );

    case 'final_cta':
      return (
        <FinalCTA
          kicker={d.finalCta.kicker ?? spec.kicker}
          headline={d.finalCta.headline}
          lede={d.finalCta.lede}
          ctaLabel={spec.ctaLabel ?? cta.label}
          ctaHref={spec.ctaHref ?? '/cart'}
          note={spec.note}
        />
      );

    case 'sticky_cta':
      return (
        <StickyCta
          label={spec.ctaLabel ?? 'Commander'}
          href={spec.ctaHref ?? '/cart'}
          priceLabel={d.priceLabel || undefined}
        />
      );

    default:
      return null;
  }
}
