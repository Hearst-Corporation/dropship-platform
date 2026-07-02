import clsx from "clsx";
import type React from "react";

/**
 * Single-line ellipsis with native tooltip. Use inside flex/grid/table cells
 * that have `min-w-0` so truncation can take effect.
 */
export interface AdminTruncatedTextProps {
  children: React.ReactNode;
  className?: string;
  /** Defaults to string children when applicable. */
  title?: string;
  as?: "span" | "p" | "div";
}

export function AdminTruncatedText({
  children,
  className,
  title,
  as: Component = "span",
}: AdminTruncatedTextProps) {
  const autoTitle = typeof children === "string" ? children : undefined;
  return (
    <Component
      className={clsx("block min-w-0 truncate", className)}
      title={title ?? autoTitle}
    >
      {children}
    </Component>
  );
}
