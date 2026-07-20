/**
 * Store mark — a neutral inline glyph for a store's identity in admin lists.
 * Rebuilt on the unified design system: no emoji, no icon library, just a
 * small currentColor bag outline that inherits the surrounding text color.
 * Props kept for call-site compatibility (`emoji` is now ignored — the
 * no-emoji product rule stands).
 */
interface Props {
  emoji?: string | null;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function StoreLogo({ size = 24, className, strokeWidth = 1.5 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 8h16l-1 11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 8Z" />
      <path d="M8 8a4 4 0 0 1 8 0" />
    </svg>
  );
}
