import Image from 'next/image';
import { Section, Eyebrow, Headline, Lede } from './shared';

/** Problem → solution, two-column narrative. */
export interface ProblemSolutionProps {
  kicker?: string;
  problem: string;
  solution: string;
  imageUrl?: string | null;
}
export function ProblemSolution({ kicker, problem, solution, imageUrl }: ProblemSolutionProps) {
  return (
    <Section tint="muted">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {imageUrl && (
          <div className="relative order-last aspect-[4/3] overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-950/5 lg:order-first">
            <Image src={imageUrl} alt="" fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
          </div>
        )}
        <div>
          {kicker && <Eyebrow>{kicker}</Eyebrow>}
          <p className="text-xl font-medium text-zinc-500 line-through decoration-zinc-300">{problem}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{solution}</p>
        </div>
      </div>
    </Section>
  );
}

/** Benefits grid (from selling_points). */
export interface BenefitsProps {
  kicker?: string;
  title?: string;
  items: Array<{ title: string; body: string }>;
}
export function Benefits({ kicker, title, items }: BenefitsProps) {
  if (!items?.length) return null;
  return (
    <Section>
      {kicker && <Eyebrow>{kicker}</Eyebrow>}
      {title && <Headline>{title}</Headline>}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-2xl border border-zinc-950/8 bg-white p-6">
            <span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-accent-50 text-sm font-semibold text-accent-700">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="text-base font-semibold text-zinc-950">{it.title}</h3>
            <p className="mt-2 text-sm/relaxed text-zinc-600">{it.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Objections handled (Q/A pairs, tighter than FAQ). */
export interface ObjectionsProps {
  title?: string;
  items: Array<{ q: string; a: string }>;
}
export function Objections({ title = 'Vos questions, honnêtement', items }: ObjectionsProps) {
  if (!items?.length) return null;
  return (
    <Section tint="muted">
      <Headline>{title}</Headline>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl bg-white p-5 ring-1 ring-zinc-950/5">
            <p className="text-sm font-semibold text-zinc-950">{it.q}</p>
            <p className="mt-1.5 text-sm/relaxed text-zinc-600">{it.a}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** FAQ accordion-style list (native details for zero-JS). */
export interface FAQProps {
  title?: string;
  items: Array<{ q: string; a: string }>;
}
export function FAQ({ title = 'Questions fréquentes', items }: FAQProps) {
  if (!items?.length) return null;
  return (
    <Section>
      <Headline>{title}</Headline>
      <div className="mx-auto mt-8 max-w-3xl divide-y divide-zinc-950/8">
        {items.map((it, i) => (
          <details key={i} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-zinc-950">
              {it.q}
              <span className="ml-4 text-accent-600 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm/relaxed text-zinc-600">{it.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
