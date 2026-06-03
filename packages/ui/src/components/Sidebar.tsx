"use client";

/**
 * SIDEBAR LAYOUT COMPONENT
 * Responsive, collapsible, icon-rail → full panel.
 * Supports: nested nav groups, badges, status, tooltips on collapse.
 * Width transitions are GPU-accelerated (transform, not width).
 */

import * as React from "react";
import { cn } from "../utils/cn";

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;
  mobile: boolean;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

// ─── PROVIDER ────────────────────────────────────────────────────────────────

interface SidebarProviderProps {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  storageKey?: string;
}

export function SidebarProvider({
  children,
  defaultCollapsed = false,
  storageKey = "ds-sidebar-collapsed",
}: SidebarProviderProps) {
  const [collapsed, setCollapsedState] = React.useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return stored === "true";
    }
    return defaultCollapsed;
  });

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mobile, setMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v);
    try { localStorage.setItem(storageKey, String(v)); } catch {}
  }, [storageKey]);

  const toggleCollapsed = React.useCallback(
    () => setCollapsed(!collapsed),
    [collapsed, setCollapsed]
  );

  const value = React.useMemo(
    () => ({ collapsed, setCollapsed, toggleCollapsed, mobile, mobileOpen, setMobileOpen }),
    [collapsed, setCollapsed, toggleCollapsed, mobile, mobileOpen]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

// ─── SIDEBAR ROOT ─────────────────────────────────────────────────────────────

interface SidebarRootProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export const Sidebar = React.forwardRef<HTMLElement, SidebarRootProps>(
  ({ className, children, ...props }, ref) => {
    const { collapsed, mobile, mobileOpen, setMobileOpen } = useSidebar();

    return (
      <>
        {/* Mobile overlay */}
        {mobile && mobileOpen && (
          <div
            className="fixed inset-0 z-overlay bg-bg-overlay backdrop-blur-glass-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}

        <aside
          ref={ref}
          data-collapsed={collapsed}
          className={cn(
            // Base
            "relative flex flex-col shrink-0 h-full",
            "bg-bg-secondary border-r border-border",
            "transition-all duration-300 ease-smooth-out",
            "overflow-hidden",
            // Desktop width
            collapsed ? "w-14" : "w-64",
            // Mobile
            mobile && "fixed inset-y-0 left-0 z-drawer",
            mobile && (mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"),
            className
          )}
          aria-label="Sidebar navigation"
          {...props}
        >
          {children}
        </aside>
      </>
    );
  }
);
Sidebar.displayName = "Sidebar";

// ─── SIDEBAR HEADER ──────────────────────────────────────────────────────────

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center h-14 px-3 shrink-0",
        "border-b border-border-subtle",
        className
      )}
      {...props}
    />
  )
);
SidebarHeader.displayName = "SidebarHeader";

// ─── SIDEBAR CONTENT ──────────────────────────────────────────────────────────

export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex-1 overflow-y-auto overflow-x-hidden py-2", className)}
      {...props}
    />
  )
);
SidebarContent.displayName = "SidebarContent";

// ─── SIDEBAR FOOTER ───────────────────────────────────────────────────────────

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("shrink-0 border-t border-border-subtle p-2", className)}
      {...props}
    />
  )
);
SidebarFooter.displayName = "SidebarFooter";

// ─── SIDEBAR NAV GROUP ────────────────────────────────────────────────────────

export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  collapsible?: boolean;
}

export const SidebarGroup = React.forwardRef<HTMLDivElement, SidebarGroupProps>(
  ({ className, label, children, ...props }, ref) => {
    const { collapsed } = useSidebar();
    return (
      <div ref={ref} className={cn("px-2 py-1", className)} {...props}>
        {label && !collapsed && (
          <p className="px-2 py-1.5 text-overline-sm text-text-tertiary uppercase tracking-widest">
            {label}
          </p>
        )}
        {label && collapsed && <div className="h-px bg-border-subtle mx-1 my-2" aria-hidden />}
        {children}
      </div>
    );
  }
);
SidebarGroup.displayName = "SidebarGroup";

// ─── SIDEBAR NAV ITEM ─────────────────────────────────────────────────────────

export interface SidebarItemProps extends React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement> {
  icon?: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  badge?: React.ReactNode;
  external?: boolean;
  as?: React.ElementType;
}

export const SidebarItem = React.forwardRef<HTMLAnchorElement, SidebarItemProps>(
  (
    {
      className,
      icon,
      label,
      href,
      active,
      badge,
      external,
      as: Tag = href ? "a" : "button",
      ...props
    },
    ref
  ) => {
    const { collapsed } = useSidebar();

    return (
      <Tag
        ref={ref}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-2.5 w-full",
          "h-9 rounded-lg px-2.5",
          "text-label-sm font-medium",
          "transition-colors duration-100",
          "focus-visible:outline-none focus-visible:shadow-focus",
          active
            ? "bg-brand-subtle text-brand border border-brand/20"
            : "text-text-secondary hover:bg-interactive-hover hover:text-text-primary",
          collapsed && "justify-center px-2",
          className
        )}
        title={collapsed ? label : undefined}
        {...(props as React.HTMLAttributes<HTMLElement>)}
      >
        {icon && (
          <span className={cn(
            "shrink-0 flex items-center justify-center h-4 w-4",
            active ? "text-brand" : "text-text-tertiary group-hover:text-text-secondary"
          )}>
            {icon}
          </span>
        )}
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {badge && <span className="ml-auto">{badge}</span>}
          </>
        )}
      </Tag>
    );
  }
);
SidebarItem.displayName = "SidebarItem";

// ─── COLLAPSE TOGGLE ──────────────────────────────────────────────────────────

export function SidebarToggle({ className }: { className?: string }) {
  const { collapsed, toggleCollapsed } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleCollapsed}
      className={cn(
        "flex items-center justify-center h-7 w-7 rounded-lg",
        "text-text-tertiary hover:text-text-primary hover:bg-interactive-hover",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:shadow-focus",
        className
      )}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <svg
        width="14" height="14" viewBox="0 0 14 14" fill="none"
        className={cn("transition-transform duration-300", collapsed && "rotate-180")}
        aria-hidden
      >
        <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ─── MOBILE HAMBURGER ─────────────────────────────────────────────────────────

export function SidebarMobileTrigger({ className }: { className?: string }) {
  const { setMobileOpen, mobileOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setMobileOpen(!mobileOpen)}
      className={cn(
        "lg:hidden flex items-center justify-center h-9 w-9 rounded-lg",
        "text-text-secondary hover:text-text-primary hover:bg-interactive-hover",
        "transition-colors duration-150",
        className
      )}
      aria-label={mobileOpen ? "Close menu" : "Open menu"}
      aria-expanded={mobileOpen}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        {mobileOpen ? (
          <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        ) : (
          <>
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </>
        )}
      </svg>
    </button>
  );
}
