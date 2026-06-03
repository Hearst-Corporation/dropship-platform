"use client";

/**
 * TOAST / NOTIFICATION SYSTEM
 * Stacked, animated, accessible.
 * Positions: top-right (default), top-center, bottom-right, bottom-center
 * Types: info, success, warning, error, loading
 */

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

// ─── PROVIDER ────────────────────────────────────────────────────────────────

type ToastPosition = "top-right" | "top-center" | "top-left" | "bottom-right" | "bottom-center" | "bottom-left";

const positionClass: Record<ToastPosition, string> = {
  "top-right":    "top-4 right-4",
  "top-center":   "top-4 left-1/2 -translate-x-1/2",
  "top-left":     "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-center":"bottom-4 left-1/2 -translate-x-1/2",
  "bottom-left":  "bottom-4 left-4",
};

export function ToastProvider({
  children,
  position = "bottom-right",
  duration = 4000,
}: {
  children: React.ReactNode;
  position?: ToastPosition;
  duration?: number;
}) {
  return (
    <ToastPrimitive.Provider duration={duration} swipeDirection="right">
      {children}
      <ToastPrimitive.Viewport
        className={cn(
          "fixed z-toast flex flex-col gap-2 w-full max-w-sm p-4",
          positionClass[position],
          "pointer-events-none [&>*]:pointer-events-auto"
        )}
      />
    </ToastPrimitive.Provider>
  );
}

// ─── TOAST VARIANTS ───────────────────────────────────────────────────────────

const toastVariants = cva(
  [
    "relative group",
    "flex items-start gap-3",
    "rounded-xl p-4 pr-10",
    "border shadow-floating",
    "data-[state=open]:animate-slide-in-right",
    "data-[state=closed]:animate-fade-out",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
    "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=end]:animate-fade-out",
    "motion-reduce:animate-none",
    "transition-all duration-200",
  ],
  {
    variants: {
      variant: {
        default: "bg-bg-primary border-border text-text-primary",
        info:    "bg-bg-primary border-info-DEFAULT/30 text-text-primary",
        success: "bg-bg-primary border-success-DEFAULT/30 text-text-primary",
        warning: "bg-bg-primary border-warning-DEFAULT/30 text-text-primary",
        error:   "bg-bg-primary border-error-DEFAULT/30 text-text-primary",
        loading: "bg-bg-primary border-border text-text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// ─── ICONS ────────────────────────────────────────────────────────────────────

function ToastIcon({ variant }: { variant?: "default" | "info" | "success" | "warning" | "error" | "loading" }) {
  if (variant === "success") return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-text mt-0.5">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
        <path d="M2 5.5L4.5 8L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
  if (variant === "error") return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-error-subtle text-error-text mt-0.5">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
        <path d="M3 3L8 8M8 3L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </span>
  );
  if (variant === "warning") return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning-subtle text-warning-text mt-0.5">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
        <path d="M5.5 3.5V6M5.5 8v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </span>
  );
  if (variant === "info") return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-info-subtle text-info-text mt-0.5">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
        <path d="M5.5 5v3M5.5 3V3.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </span>
  );
  if (variant === "loading") return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
      <svg className="animate-spin text-text-tertiary" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3"/>
        <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </span>
  );
  return null;
}

// ─── TOAST COMPONENT ──────────────────────────────────────────────────────────

export interface ToastProps
  extends Omit<React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>, "asChild">,
    VariantProps<typeof toastVariants> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  actionAltText?: string;
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, variant, title, description, action, actionAltText = "action", children, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  >
    <ToastIcon variant={variant ?? "default"} />
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      {title && (
        <ToastPrimitive.Title className="text-label-md font-semibold text-text-primary leading-snug">
          {title}
        </ToastPrimitive.Title>
      )}
      {description && (
        <ToastPrimitive.Description className="text-caption-md text-text-secondary">
          {description}
        </ToastPrimitive.Description>
      )}
      {children}
    </div>
    {action && (
      <ToastPrimitive.Action className="shrink-0" altText={actionAltText} asChild>
        {action}
      </ToastPrimitive.Action>
    )}
    <ToastPrimitive.Close
      className={cn(
        "absolute right-2 top-2 h-6 w-6 rounded-lg",
        "flex items-center justify-center",
        "text-text-quaternary hover:text-text-primary hover:bg-interactive-hover",
        "transition-colors duration-150",
        "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-focus",
      )}
      aria-label="Close"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
        <path d="M9.5 2.5l-7 7M2.5 2.5l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </ToastPrimitive.Close>
  </ToastPrimitive.Root>
));
Toast.displayName = "Toast";

// ─── HOOK ──────────────────────────────────────────────────────────────────────

interface ToastState {
  id: string;
  variant: ToastProps["variant"];
  title?: string;
  description?: string;
  duration?: number;
}

type ToastAction =
  | { type: "ADD"; toast: ToastState }
  | { type: "REMOVE"; id: string };

const toastStore = {
  toasts: [] as ToastState[],
  listeners: new Set<(toasts: ToastState[]) => void>(),
  dispatch(action: ToastAction) {
    if (action.type === "ADD") {
      this.toasts = [...this.toasts, action.toast];
    } else {
      this.toasts = this.toasts.filter((t) => t.id !== action.id);
    }
    this.listeners.forEach((l) => l(this.toasts));
  },
};

let counter = 0;
export function toast(options: Omit<ToastState, "id"> | string) {
  const id = `toast-${++counter}`;
  const t: ToastState = typeof options === "string"
    ? { id, title: options, variant: "default" }
    : { id, ...options };
  toastStore.dispatch({ type: "ADD", toast: t });
  return id;
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });
toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "error" });
toast.warning = (title: string, description?: string) =>
  toast({ title, description, variant: "warning" });
toast.info = (title: string, description?: string) =>
  toast({ title, description, variant: "info" });
toast.loading = (title: string, description?: string) =>
  toast({ title, description, variant: "loading", duration: Infinity });

export { Toast, toastVariants };
