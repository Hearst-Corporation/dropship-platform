import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

// ─── CVA ──────────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 whitespace-nowrap font-medium",
    "transition-colors duration-150",
  ],
  {
    variants: {
      variant: {
        // Neutral
        default:    "bg-bg-secondary text-text-secondary border border-border",
        // Brand
        primary:    "bg-brand-subtle text-brand border border-brand/20",
        // Status
        success:    "bg-success-subtle text-success-text border border-success/20",
        warning:    "bg-warning-subtle text-warning-text border border-warning/20",
        error:      "bg-error-subtle text-error-text border border-error/20",
        info:       "bg-info-subtle text-info-text border border-info/20",
        // Filled
        "primary-filled":  "bg-brand text-white border-0",
        "success-filled":  "bg-success text-white border-0",
        "warning-filled":  "bg-warning text-white border-0",
        "error-filled":    "bg-error text-white border-0",
        // Monochrome
        neutral:    "bg-bg-tertiary text-text-tertiary border-0",
        // Dark badge
        dark:       "bg-bg-inverse text-text-inverse border-0",
        // Outline only
        outline:    "bg-transparent text-text-secondary border border-border",
      },

      size: {
        xs: "h-4 px-1.5 text-[10px] rounded",
        sm: "h-5 px-2 text-caption-sm rounded-md",
        md: "h-6 px-2.5 text-caption-md rounded-md",
        lg: "h-7 px-3 text-label-sm rounded-lg",
      },

      dot: {
        true:  "",
        false: "",
      },

      pill: {
        true:  "rounded-full",
        false: "",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "md",
      dot: false,
      pill: true,
    },
  }
);

// ─── DOT ──────────────────────────────────────────────────────────────────────

const dotColors: Record<string, string> = {
  default:         "bg-text-tertiary",
  primary:         "bg-brand",
  success:         "bg-success",
  warning:         "bg-warning",
  error:           "bg-error",
  info:            "bg-info",
  "primary-filled":"bg-white/70",
  "success-filled":"bg-white/70",
  "warning-filled":"bg-white/70",
  "error-filled":  "bg-white/70",
  neutral:         "bg-text-quaternary",
  dark:            "bg-white/60",
  outline:         "bg-text-tertiary",
};

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  removable?: boolean;
  onRemove?: () => void;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size, dot, pill, removable, onRemove, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size, dot, pill }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "inline-block shrink-0 rounded-full",
            size === "xs" ? "h-1.5 w-1.5" : size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
            dotColors[variant ?? "default"]
          )}
          aria-hidden
        />
      )}
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 -mr-0.5 inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Remove"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M7.5 2.5l-5 5M2.5 2.5l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </span>
  )
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
