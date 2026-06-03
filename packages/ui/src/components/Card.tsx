"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

// ─── CVA ──────────────────────────────────────────────────────────────────────

const cardVariants = cva(
  [
    "rounded-xl bg-bg-primary text-text-primary",
    "transition-all duration-200 ease-smooth-out",
  ],
  {
    variants: {
      variant: {
        // Default elevated card
        default: "border border-border shadow-sm",

        // Flat — no shadow, minimal border
        flat: "border border-border-subtle",

        // Elevated — higher shadow for prominence
        elevated: "border border-border shadow-lg",

        // Outlined — emphasis on border
        outlined: "border-2 border-border-strong",

        // Ghost — no border/shadow
        ghost: "border-0 shadow-none bg-transparent",

        // Glass — frosted glass effect
        glass: [
          "border border-glass-border bg-bg-glass",
          "backdrop-blur-glass shadow-glass",
        ],

        // Filled — uses secondary bg
        filled: "bg-bg-secondary border-0 shadow-none",

        // Interactive — hover state
        interactive: [
          "border border-border shadow-sm cursor-pointer",
          "hover:border-border-brand hover:shadow-md hover:-translate-y-0.5",
          "active:translate-y-0 active:shadow-sm",
        ],

        // Gradient border (premium)
        "gradient-border": [
          "relative border-0 shadow-md",
          "before:absolute before:inset-0 before:rounded-[inherit] before:p-px",
          "before:bg-gradient-brand before:-z-[1]",
          "after:absolute after:inset-px after:rounded-[calc(var(--radius-xl)-1px)] after:bg-bg-primary after:-z-[1]",
        ],
      },

      padding: {
        none:  "p-0",
        xs:    "p-3",
        sm:    "p-4",
        md:    "p-5",
        lg:    "p-6",
        xl:    "p-8",
        "2xl": "p-10",
      },

      radius: {
        sm:   "rounded-lg",
        md:   "rounded-xl",
        lg:   "rounded-2xl",
        xl:   "rounded-3xl",
        full: "rounded-full",
      },
    },

    defaultVariants: {
      variant: "default",
      padding: "md",
      radius: "md",
    },
  }
);

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  as?: React.ElementType;
}

// ─── CARD ROOT ────────────────────────────────────────────────────────────────

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, radius, as: Tag = "div", ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn(cardVariants({ variant, padding, radius }), className)}
      {...props}
    />
  )
);

Card.displayName = "Card";

// ─── CARD SUB-COMPONENTS ──────────────────────────────────────────────────────

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-heading-sm font-semibold text-text-primary leading-none", className)}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-body-sm text-text-secondary", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center pt-4 border-t border-border-subtle", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

// ─── KPI CARD ─────────────────────────────────────────────────────────────────

export interface KpiCardProps extends CardProps {
  title: string;
  value: string | number;
  delta?: string | number;
  deltaLabel?: string;
  deltaPositive?: boolean;
  icon?: React.ReactNode;
  chart?: React.ReactNode;
}

function KpiCard({
  title,
  value,
  delta,
  deltaLabel,
  deltaPositive,
  icon,
  chart,
  className,
  ...props
}: KpiCardProps) {
  const deltaColor =
    deltaPositive === undefined
      ? "text-text-secondary"
      : deltaPositive
      ? "text-success-text"
      : "text-error-text";

  return (
    <Card className={cn("flex flex-col gap-3", className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-label-sm text-text-secondary uppercase tracking-overline truncate">
            {title}
          </p>
          <p className="text-heading-xl font-bold text-text-primary tabular-nums leading-none">
            {value}
          </p>
        </div>
        {icon && (
          <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-brand-subtle text-brand">
            {icon}
          </div>
        )}
      </div>
      {delta !== undefined && (
        <p className={cn("text-label-sm flex items-center gap-1.5", deltaColor)}>
          <span className="font-semibold">
            {deltaPositive !== undefined && (deltaPositive ? "↑" : "↓")} {delta}
          </span>
          {deltaLabel && (
            <span className="text-text-tertiary">{deltaLabel}</span>
          )}
        </p>
      )}
      {chart && <div className="-mx-1">{chart}</div>}
    </Card>
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  KpiCard,
  cardVariants,
};
