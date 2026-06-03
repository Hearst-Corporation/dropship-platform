"use client";

import * as React from "react";
import { cn } from "../utils/cn";

// ─── TOPBAR ROOT ─────────────────────────────────────────────────────────────

export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  sticky?: boolean;
  transparent?: boolean;
  blurred?: boolean;
  bordered?: boolean;
}

export const Topbar = React.forwardRef<HTMLElement, TopbarProps>(
  (
    {
      className,
      children,
      sticky = true,
      transparent = false,
      blurred = false,
      bordered = true,
      ...props
    },
    ref
  ) => (
    <header
      ref={ref}
      className={cn(
        "flex items-center h-14 px-4 gap-3 shrink-0 z-sticky w-full",
        sticky && "sticky top-0",
        !transparent && "bg-bg-primary",
        blurred && "bg-bg-glass backdrop-blur-glass",
        bordered && "border-b border-border-subtle",
        "transition-all duration-200",
        className
      )}
      {...props}
    >
      {children}
    </header>
  )
);
Topbar.displayName = "Topbar";

// ─── TOPBAR SECTIONS ──────────────────────────────────────────────────────────

export const TopbarLeft = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-3 shrink-0", className)} {...props} />
  )
);
TopbarLeft.displayName = "TopbarLeft";

export const TopbarCenter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 flex items-center justify-center", className)} {...props} />
  )
);
TopbarCenter.displayName = "TopbarCenter";

export const TopbarRight = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 ml-auto", className)} {...props} />
  )
);
TopbarRight.displayName = "TopbarRight";

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-label-sm", className)}
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <svg className="text-text-quaternary shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {item.href && i < items.length - 1 ? (
              <a
                href={item.href}
                className="text-text-tertiary hover:text-text-primary transition-colors duration-100 truncate max-w-[120px]"
              >
                {item.label}
              </a>
            ) : (
              <span
                className={cn(
                  "truncate max-w-[160px]",
                  i === items.length - 1 ? "text-text-primary font-medium" : "text-text-tertiary"
                )}
                aria-current={i === items.length - 1 ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ─── PAGE LAYOUT ──────────────────────────────────────────────────────────────

export interface PageLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  topbar?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageLayout({
  children,
  sidebar,
  topbar,
  className,
  contentClassName,
}: PageLayoutProps) {
  return (
    <div className={cn("flex h-screen w-full overflow-hidden bg-bg-canvas", className)}>
      {sidebar}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {topbar}
        <main
          className={cn(
            "flex-1 overflow-y-auto",
            contentClassName
          )}
          id="main-content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── PAGE HEADER ──────────────────────────────────────────────────────────────

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
  tabs?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  tabs,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-0 border-b border-border-subtle", className)}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div className="flex flex-col gap-1 min-w-0">
          {breadcrumb && (
            <Breadcrumb items={breadcrumb} className="mb-1" />
          )}
          <h1 className="text-heading-xl font-bold text-text-primary truncate">
            {title}
          </h1>
          {description && (
            <p className="text-body-sm text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 mt-1">
            {actions}
          </div>
        )}
      </div>
      {tabs && <div className="px-6">{tabs}</div>}
    </div>
  );
}

// ─── CONTENT AREA ─────────────────────────────────────────────────────────────

export interface ContentAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

export const ContentArea = React.forwardRef<HTMLDivElement, ContentAreaProps>(
  ({ className, padded = true, maxWidth, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        padded && "p-6",
        maxWidth === "sm"  && "max-w-sm mx-auto",
        maxWidth === "md"  && "max-w-md mx-auto",
        maxWidth === "lg"  && "max-w-lg mx-auto",
        maxWidth === "xl"  && "max-w-xl mx-auto",
        maxWidth === "2xl" && "max-w-2xl mx-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
ContentArea.displayName = "ContentArea";
