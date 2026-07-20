import { Avatar } from '@/components/ui/avatar';

/**
 * Store monogram avatar — thin wrapper over the design-system Avatar.
 * Renders deterministic initials from the store name on the unified
 * (indigo) accent surface.
 */
interface Props {
  slug?: string;
  name: string;
  size?: number;
  className?: string;
}

function initials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '·';
  const parts = cleaned.split(/[\s·\-_/]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

export function StoreAvatar({ name, size = 32, className }: Props) {
  return (
    <Avatar
      square
      initials={initials(name)}
      className={`bg-accent-600 text-white ${className ?? ''}`}
      style={{ width: size, height: size } as React.CSSProperties}
    />
  );
}
