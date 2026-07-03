import { cn } from '@/lib/utils/cn';

/**
 * Premium monogram avatar for stores in admin lists. Locked to the
 * admin palette: black + indigo (the single accent) + white only. Each
 * store still gets a deterministic, distinct look (8 variants) so a list
 * of 30 stores never reads as a single repeated tile.
 *
 * The 8 variants mix: solid black, solid indigo (3 shades), white-over-black,
 * and 3 black↔indigo gradients. Enough rhythm without leaving the palette.
 */

interface Props {
  slug: string;
  name: string;
  size?: number;
  className?: string;
}

interface Variant {
  bg: string;
  fg: string;
  /** Optional ring/border to add contrast on light surfaces. */
  ring?: string;
}

// All values are flat or gradient — only #000, white, and the indigo scale
// (single-accent policy) allowed. Order is irrelevant; the slug hash picks
// deterministically.
//
// Hex ↔ Tailwind scale (default palette), for reference only. Values that
// match a token defined in app/globals.css reference that token (var(...))
// so they stay in sync with the admin accent; values with no equivalent
// token (indigo-900, indigo-500 — one-off avatar variants, not shared DS
// tokens) stay as documented hex literals. Do not change the values.
//   #0a0a0a → neutral-950 (admin dark-surface literal, no single token)
//   #ffffff → white (no dedicated token — admin-text-inverse is semantically
//             "text", not "avatar surface")
//   #4f46e5 → indigo-600 → var(--admin-accent)
//   #312e81 → indigo-900 (no matching token)
//   #6366f1 → indigo-500 (no matching token)
const VARIANTS: Variant[] = [
  // 1. Solid black
  { bg: '#0a0a0a',                                                                       fg: '#ffffff' },
  // 2. Solid indigo (primary accent)
  { bg: 'var(--admin-accent)',                                                           fg: '#ffffff' },
  // 3. Deep indigo
  { bg: '#312e81',                                                                       fg: '#ffffff' },
  // 4. Bright indigo
  { bg: '#6366f1',                                                                       fg: '#ffffff' },
  // 5. White card with thin black border
  { bg: '#ffffff',                                                                       fg: '#0a0a0a', ring: '#0a0a0a' },
  // 6. Gradient black → indigo
  { bg: 'linear-gradient(135deg, #0a0a0a 0%, var(--admin-accent) 100%)',                 fg: '#ffffff' },
  // 7. Gradient indigo → black
  { bg: 'linear-gradient(135deg, #6366f1 0%, #0a0a0a 100%)',                             fg: '#ffffff' },
  // 8. Gradient deep indigo → indigo
  { bg: 'linear-gradient(135deg, #312e81 0%, var(--admin-accent) 100%)',                 fg: '#ffffff' },
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

function initials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '·';
  const parts = cleaned.split(/[\s·\-_/]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function StoreAvatar({ slug, name, size = 32, className }: Props) {
  const variant = VARIANTS[hashSlug(slug) % VARIANTS.length]!;
  const fontSize = Math.round(size * 0.42);

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.08)] select-none',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: variant.bg,
        color: variant.fg,
        boxShadow: variant.ring
          ? `inset 0 0 0 1px ${variant.ring}, 0 1px 2px rgba(0,0,0,0.06)`
          : undefined,
        fontSize,
        lineHeight: 1,
      }}
    >
      {initials(name)}
    </span>
  );
}
