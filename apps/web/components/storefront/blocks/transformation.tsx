import Image from 'next/image';
import { Section, Eyebrow, Headline } from './shared';

/**
 * Transformation — deux panneaux « avant / après » d'USAGE (le geste avant, le
 * geste avec le produit). Volontairement NON médical / NON trompeur : il montre
 * une situation d'usage, pas une promesse de résultat clinique. Rend null sans
 * contenu. Images optionnelles (structure fonctionne sans image).
 */
export interface TransformationProps {
  kicker?: string;
  title?: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeText: string;
  afterText: string;
  beforeImage?: string | null;
  afterImage?: string | null;
}
export function Transformation({
  kicker,
  title = 'Avant / après',
  beforeLabel = 'Sans',
  afterLabel = 'Avec',
  beforeText,
  afterText,
  beforeImage,
  afterImage,
}: TransformationProps) {
  if (!beforeText && !afterText) return null;
  return (
    <Section tint="muted">
      {kicker && <Eyebrow>{kicker}</Eyebrow>}
      <Headline>{title}</Headline>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <Panel tone="before" label={beforeLabel} text={beforeText} image={beforeImage} />
        <Panel tone="after" label={afterLabel} text={afterText} image={afterImage} />
      </div>
    </Section>
  );
}

function Panel({
  tone,
  label,
  text,
  image,
}: {
  tone: 'before' | 'after';
  label: string;
  text: string;
  image?: string | null;
}) {
  const isAfter = tone === 'after';
  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        isAfter ? 'border-accent-200 bg-white ring-1 ring-accent-600/10' : 'border-zinc-950/8 bg-white'
      }`}
    >
      {image && (
        <div className="relative aspect-[4/3] w-full bg-zinc-100">
          <Image src={image} alt="" fill sizes="(min-width:640px) 45vw, 100vw" className="object-cover" />
        </div>
      )}
      <div className="p-6">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            isAfter ? 'bg-accent-600 text-white' : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {label}
        </span>
        <p className="mt-3 text-base/relaxed text-zinc-700">{text}</p>
      </div>
    </div>
  );
}
