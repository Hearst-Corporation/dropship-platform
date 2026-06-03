"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

// ─── CVA DEFINITION ───────────────────────────────────────────────────────────

const buttonVariants = cva(
  // Base styles — applied to every button variant
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium leading-none select-none",
    "transition-all duration-150 ease-smooth-out",
    "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-focus",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-[0.97]",
    // Touch target guarantee
    "min-h-[var(--layout-component-md)]",
    // Respect reduced motion
    "motion-reduce:transition-none motion-reduce:active:scale-100",
  ],
  {
    variants: {
      variant: {
        // ── Filled — primary action ──────────────────────────────────────
        primary: [
          "bg-brand text-white",
          "hover:bg-brand-hover hover:shadow-glow",
          "active:bg-brand-active",
          "shadow-sm hover:shadow-md",
        ],

        // ── Secondary — secondary action ──────────────────────────────────
        secondary: [
          "bg-bg-secondary text-text-primary border border-border",
          "hover:bg-interactive-hover hover:border-border-strong hover:shadow-sm",
          "active:bg-interactive-pressed",
        ],

        // ── Ghost — low-emphasis ──────────────────────────────────────────
        ghost: [
          "bg-transparent text-text-secondary",
          "hover:bg-interactive-hover hover:text-text-primary",
          "active:bg-interactive-pressed",
        ],

        // ── Outline — medium-emphasis ─────────────────────────────────────
        outline: [
          "bg-transparent text-text-primary border border-border",
          "hover:bg-bg-secondary hover:border-border-strong",
          "active:bg-interactive-pressed",
        ],

        // ── Brand outline ─────────────────────────────────────────────────
        "brand-outline": [
          "bg-transparent text-brand-DEFAULT border border-brand",
          "hover:bg-brand-subtle hover:shadow-sm",
          "active:bg-brand-subtle-hover",
        ],

        // ── Destructive ───────────────────────────────────────────────────
        destructive: [
          "bg-error-DEFAULT text-white shadow-sm",
          "hover:bg-red-600 hover:shadow-md",
          "active:bg-red-700",
        ],

        // ── Destructive ghost ─────────────────────────────────────────────
        "destructive-ghost": [
          "bg-transparent text-error-text",
          "hover:bg-error-subtle hover:text-error-DEFAULT",
          "active:bg-error-subtle",
        ],

        // ── Gradient — premium CTA ────────────────────────────────────────
        gradient: [
          "bg-gradient-brand text-white shadow-sm",
          "hover:shadow-glow hover:opacity-90",
          "active:opacity-100",
          "before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-shine before:opacity-0 hover:before:opacity-100 before:transition-opacity",
          "overflow-hidden",
        ],

        // ── Glass ─────────────────────────────────────────────────────────
        glass: [
          "bg-bg-glass backdrop-blur-glass border border-glass-border text-text-primary",
          "shadow-glass hover:shadow-glass-lg",
          "hover:bg-bg-glass-strong",
          "active:bg-interactive-pressed",
        ],

        // ── Link ──────────────────────────────────────────────────────────
        link: [
          "bg-transparent text-text-link p-0 h-auto min-h-0 font-normal underline-offset-4",
          "hover:underline hover:text-text-linkHover",
          "active:opacity-80",
        ],
      },

      size: {
        xs: [
          "h-7 px-2.5 text-label-xs rounded-md gap-1",
          "min-h-[var(--layout-component-xs)]",
        ],
        sm: [
          "h-8 px-3 text-label-sm rounded-md gap-1.5",
          "min-h-[var(--layout-component-sm)]",
        ],
        md: [
          "h-9 px-4 text-label-md rounded-lg gap-2",
          "min-h-[var(--layout-component-md)]",
        ],
        lg: [
          "h-10 px-5 text-label-lg rounded-lg gap-2",
          "min-h-[var(--layout-component-lg)]",
        ],
        xl: [
          "h-12 px-6 text-body-md rounded-xl gap-2.5",
          "min-h-[var(--layout-component-xl)]",
        ],
        "2xl": [
          "h-14 px-8 text-body-lg rounded-xl gap-3",
        ],
        icon: [
          "h-9 w-9 rounded-lg p-0",
          "min-h-[var(--layout-component-md)]",
        ],
        "icon-sm": [
          "h-7 w-7 rounded-md p-0",
        ],
        "icon-lg": [
          "h-11 w-11 rounded-xl p-0",
        ],
      },

      loading: {
        true: "cursor-wait pointer-events-none",
        false: "",
      },

      fullWidth: {
        true:  "w-full",
        false: "",
      },

      pill: {
        true:  "rounded-full",
        false: "",
      },
    },

    defaultVariants: {
      variant: "primary",
      size: "md",
      loading: false,
      fullWidth: false,
      pill: false,
    },
  }
);

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loadingText?: string;
}

// ─── SPINNER ──────────────────────────────────────────────────────────────────

function ButtonSpinner({ size = "md" }: { size?: "xs" | "sm" | "md" | "lg" | "xl" }) {
  const dim = { xs: 12, sm: 14, md: 16, lg: 18, xl: 20 }[size] ?? 16;
  return (
    <svg
      className="animate-spin"
      width={dim}
      height={dim}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle
        cx="8" cy="8" r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.3"
      />
      <path
        d="M14 8a6 6 0 00-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      fullWidth,
      pill,
      leftIcon,
      rightIcon,
      loadingText,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading === true;
    const spinnerSize = (size as "xs" | "sm" | "md" | "lg" | "xl") ?? "md";

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size, loading: loading ?? false, fullWidth, pill }),
          className
        )}
        aria-busy={loading ?? undefined}
        {...props}
      >
        {loading ? (
          <>
            <ButtonSpinner size={spinnerSize} />
            {loadingText ?? children}
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="shrink-0 inline-flex" aria-hidden>
                {leftIcon}
              </span>
            )}
            {children}
            {rightIcon && (
              <span className="shrink-0 inline-flex" aria-hidden>
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
