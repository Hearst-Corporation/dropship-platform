import { Section, Eyebrow, Headline } from './shared';

/** Spec sheet (key/value grid) — for tech/gadget templates. */
export interface SpecsProps {
  kicker?: string;
  title?: string;
  specs: Array<{ key: string; value: string }>;
}
export function Specs({ kicker, title = 'Spécifications', specs }: SpecsProps) {
  if (!specs?.length) return null;
  return (
    <Section tint="dark">
      {kicker && <Eyebrow onDark>{kicker}</Eyebrow>}
      <Headline onDark>{title}</Headline>
      <dl className="mt-10 grid gap-x-10 gap-y-0 sm:grid-cols-2">
        {specs.map((s, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-4 border-b border-white/10 py-4"
          >
            <dt className="text-sm text-zinc-400">{s.key}</dt>
            <dd className="text-right text-sm font-semibold text-white">{s.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** Comparison: this product vs a generic alternative. */
export interface ComparisonProps {
  title?: string;
  ours: string;
  theirs?: string;
  rows: Array<{ label: string; us: boolean; them: boolean }>;
}
export function Comparison({
  title = 'Pourquoi ce choix',
  ours,
  theirs = 'Générique',
  rows,
}: ComparisonProps) {
  if (!rows?.length) return null;
  return (
    <Section>
      <Headline>{title}</Headline>
      <div className="mt-10 overflow-hidden rounded-2xl border border-zinc-950/8">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-950/8 bg-zinc-50">
              <th className="px-5 py-4 font-medium text-zinc-500"> </th>
              <th className="px-5 py-4 text-center font-semibold text-accent-700">{ours}</th>
              <th className="px-5 py-4 text-center font-medium text-zinc-500">{theirs}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-950/8">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-5 py-4 text-zinc-700">{r.label}</td>
                <td className="px-5 py-4 text-center">
                  <Mark on={r.us} />
                </td>
                <td className="px-5 py-4 text-center">
                  <Mark on={r.them} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Mark({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent-600 text-xs text-white">
      ✓
    </span>
  ) : (
    <span className="text-zinc-300">—</span>
  );
}
