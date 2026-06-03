import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

// ─── CVA ──────────────────────────────────────────────────────────────────────

const avatarVariants = cva(
  "relative inline-flex shrink-0 overflow-hidden select-none",
  {
    variants: {
      size: {
        "2xs": "h-5 w-5 text-[8px]",
        xs:    "h-6 w-6 text-[10px]",
        sm:    "h-7 w-7 text-caption-sm",
        md:    "h-8 w-8 text-caption-md",
        lg:    "h-10 w-10 text-label-sm",
        xl:    "h-12 w-12 text-label-md",
        "2xl": "h-14 w-14 text-body-sm",
        "3xl": "h-16 w-16 text-body-md",
        "4xl": "h-20 w-20 text-heading-sm",
      },
      shape: {
        circle: "rounded-full",
        square: "rounded-lg",
        soft:   "rounded-xl",
      },
      ring: {
        none:    "",
        default: "ring-2 ring-bg-primary",
        brand:   "ring-2 ring-brand",
        white:   "ring-2 ring-white",
      },
    },
    defaultVariants: {
      size: "md",
      shape: "circle",
      ring: "none",
    },
  }
);

// ─── FALLBACK COLORS ──────────────────────────────────────────────────────────
// Generates consistent color from initials string

const fallbackPalette = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
];

function getInitialsColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return fallbackPalette[Math.abs(hash) % fallbackPalette.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  name?: string;
  fallback?: React.ReactNode;
  status?: "online" | "offline" | "away" | "busy" | "none";
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size, shape, ring, src, alt, name, fallback, status, ...props }, ref) => {
    const [imgError, setImgError] = React.useState(false);
    const initials = name ? getInitials(name) : null;
    const colorClass = name ? getInitialsColor(name) : "bg-bg-tertiary text-text-secondary";

    const statusColors: Record<string, string> = {
      online:  "bg-success",
      offline: "bg-text-quaternary",
      away:    "bg-warning",
      busy:    "bg-error",
    };

    const statusSize: Record<string, string> = {
      "2xs": "h-1.5 w-1.5",
      xs:    "h-1.5 w-1.5",
      sm:    "h-2 w-2",
      md:    "h-2.5 w-2.5",
      lg:    "h-3 w-3",
      xl:    "h-3 w-3",
      "2xl": "h-3.5 w-3.5",
      "3xl": "h-3.5 w-3.5",
      "4xl": "h-4 w-4",
    };

    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ size, shape, ring }), className)}
        {...props}
      >
        {src && !imgError ? (
          <img
            src={src}
            alt={alt ?? name ?? "avatar"}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : initials ? (
          <span className={cn("flex h-full w-full items-center justify-center font-semibold", colorClass)}>
            {initials}
          </span>
        ) : fallback ? (
          <span className="flex h-full w-full items-center justify-center bg-bg-tertiary text-text-tertiary">
            {fallback}
          </span>
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-bg-tertiary text-text-tertiary">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-[60%] w-[60%]" aria-hidden>
              <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM8 9a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </span>
        )}

        {status && status !== "none" && (
          <span
            className={cn(
              "absolute bottom-0 right-0 rounded-full ring-2 ring-bg-primary",
              statusColors[status] ?? "bg-text-quaternary",
              statusSize[size ?? "md"]
            )}
            aria-label={status}
          />
        )}
      </span>
    );
  }
);

Avatar.displayName = "Avatar";

// ─── AVATAR GROUP ─────────────────────────────────────────────────────────────

interface AvatarGroupProps {
  avatars: AvatarProps[];
  max?: number;
  size?: AvatarProps["size"];
  className?: string;
  overlap?: boolean;
}

function AvatarGroup({ avatars, max = 4, size = "md", className, overlap = true }: AvatarGroupProps) {
  const shown = avatars.slice(0, max);
  const overflow = avatars.length - max;

  return (
    <div className={cn("flex items-center", overlap && "-space-x-2", className)}>
      {shown.map((avatar, i) => (
        <Avatar
          key={i}
          {...avatar}
          size={size}
          ring="white"
          className={cn("border-2 border-bg-primary", avatar.className)}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            avatarVariants({ size, shape: "circle", ring: "white" }),
            "border-2 border-bg-primary bg-bg-secondary text-text-secondary font-medium"
          )}
          aria-label={`${overflow} more`}
        >
          <span className="flex h-full w-full items-center justify-center text-[inherit]">
            +{overflow}
          </span>
        </span>
      )}
    </div>
  );
}

export { Avatar, AvatarGroup, avatarVariants };
