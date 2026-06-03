import * as React from "react";
import { cn } from "../utils/cn";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "line" | "circle" | "rect" | "text" | "card";
  width?: string | number;
  height?: string | number;
  lines?: number;
  animated?: boolean;
}

// ─── SHIMMER BASE ─────────────────────────────────────────────────────────────

const shimmerBase = [
  "bg-gradient-to-r from-bg-secondary via-bg-tertiary to-bg-secondary",
  "bg-[length:200%_100%]",
  "animate-shimmer",
  "motion-reduce:animate-none",
].join(" ");

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function Skeleton({
  variant = "rect",
  width,
  height,
  lines = 3,
  animated = true,
  className,
  style,
  ...props
}: SkeletonProps) {
  const base = cn(
    "rounded-lg overflow-hidden",
    animated ? shimmerBase : "bg-bg-secondary",
    className
  );

  const sizeStyle: React.CSSProperties = {
    width:  typeof width  === "number" ? `${width}px`  : width,
    height: typeof height === "number" ? `${height}px` : height,
    ...style,
  };

  if (variant === "circle") {
    const dim = typeof width === "number" ? `${width}px` : width ?? "2.5rem";
    return (
      <div
        className={cn(base, "rounded-full")}
        style={{ width: dim, height: dim, ...style }}
        aria-hidden
        {...props}
      />
    );
  }

  if (variant === "text") {
    return (
      <div className="flex flex-col gap-2" aria-hidden {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(base, "h-4")}
            style={{ width: i === lines - 1 ? "60%" : "100%" }}
          />
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn("rounded-xl border border-border bg-bg-primary p-5 flex flex-col gap-4", className)}
        aria-hidden
        {...props}
      >
        <div className="flex items-center gap-3">
          <div className={cn(base, "h-10 w-10 rounded-full shrink-0")} />
          <div className="flex flex-col gap-2 flex-1">
            <div className={cn(base, "h-4 w-32")} />
            <div className={cn(base, "h-3 w-24")} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className={cn(base, "h-3 w-full")} />
          <div className={cn(base, "h-3 w-full")} />
          <div className={cn(base, "h-3 w-2/3")} />
        </div>
        <div className={cn(base, "h-8 w-24 rounded-lg")} />
      </div>
    );
  }

  return (
    <div
      className={base}
      style={sizeStyle}
      aria-hidden
      {...props}
    />
  );
}

// ─── TABLE SKELETON ───────────────────────────────────────────────────────────

export function TableSkeleton({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0 border border-border rounded-xl overflow-hidden", className)} aria-hidden>
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-border bg-bg-secondary">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="rect" height={12} className="flex-1 rounded" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-border-subtle last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              variant="rect"
              height={14}
              className="flex-1 rounded"
              style={{ width: c === 0 ? "40%" : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
