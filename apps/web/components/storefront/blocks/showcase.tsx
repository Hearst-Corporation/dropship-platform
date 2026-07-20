import Image from 'next/image';
import { Section, Eyebrow, Headline, Lede } from './shared';

/**
 * Showcase — section image-led : une grande image produit/lifestyle + une
 * courte liste de points. Sert à « héroïser » le produit hors du hero. Rend
 * null sans image (jamais de cadre vide).
 */
export interface ShowcaseProps {
  kicker?: string;
  title?: string;
  lede?: string;
  imageUrl?: string | null;
  /** Grille lifestyle optionnelle (rendue sous l'image principale). */
  galleryImages?: string[];
  points?: string[];
  tone?: 'plain' | 'muted' | 'dark';
}
export function Showcase({ kicker, title, lede, imageUrl, galleryImages = [], points = [], tone = 'plain' }: ShowcaseProps) {
  if (!imageUrl && galleryImages.length === 0) return null;
  const onDark = tone === 'dark';
  const primary = imageUrl ?? galleryImages[0];
  return (
    <Section tint={tone}>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {primary && (
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-zinc-100 ring-1 ring-zinc-950/5">
            <Image src={primary} alt="" fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
          </div>
        )}
        <div>
          {kicker && <Eyebrow onDark={onDark}>{kicker}</Eyebrow>}
          {title && <Headline onDark={onDark}>{title}</Headline>}
          {lede && <Lede onDark={onDark}>{lede}</Lede>}
          {points.length > 0 && (
            <ul className="mt-8 space-y-3">
              {points.slice(0, 5).map((p, i) => (
                <li key={i} className={`flex items-start gap-3 text-sm/relaxed ${onDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-accent-600" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {galleryImages.length > 1 && (
        <div className="mt-10 grid grid-cols-3 gap-3">
          {galleryImages.slice(0, 3).map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-950/5">
              <Image src={src} alt="" fill sizes="(min-width:640px) 30vw, 33vw" className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
