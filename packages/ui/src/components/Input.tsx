"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

// ─── WRAPPER VARIANTS ─────────────────────────────────────────────────────────

const inputWrapperVariants = cva(
  [
    "relative flex items-center gap-2",
    "rounded-lg border bg-bg-primary",
    "transition-all duration-150 ease-smooth-out",
    "focus-within:border-border-brand focus-within:shadow-[0_0_0_3px_rgba(var(--color-primary-alpha-16))]",
    "has-[:disabled]:opacity-40 has-[:disabled]:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        default: "border-border",
        filled:  "bg-bg-secondary border-transparent",
        ghost:   "border-transparent bg-transparent hover:bg-interactive-hover focus-within:bg-bg-primary",
        error:   "border-border-error focus-within:border-border-error focus-within:shadow-[0_0_0_3px_rgba(var(--color-red-500)/0.16)]",
        success: "border-border-success focus-within:border-border-success",
      },
      size: {
        sm: "h-8 px-2.5 text-label-sm rounded-md",
        md: "h-9 px-3 text-label-md rounded-lg",
        lg: "h-10 px-3.5 text-body-md rounded-lg",
        xl: "h-12 px-4 text-body-md rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// ─── INPUT ELEMENT STYLES ─────────────────────────────────────────────────────

const inputStyles = [
  "flex-1 bg-transparent outline-none border-none",
  "text-text-primary placeholder:text-text-tertiary",
  "disabled:cursor-not-allowed",
  "text-inherit leading-none",
  // Remove autofill browser styling
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_var(--color-bg-primary)]",
  "[&:-webkit-autofill]:text-fill-[var(--color-text-primary)]",
].join(" ");

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputWrapperVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  loading?: boolean;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      leftIcon,
      rightIcon,
      rightElement,
      leftElement,
      loading,
      type = "text",
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn(inputWrapperVariants({ variant, size }), className)}>
        {leftElement}
        {leftIcon && (
          <span className="shrink-0 text-text-tertiary" aria-hidden>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          type={type}
          className={inputStyles}
          {...props}
        />
        {loading && (
          <svg className="animate-spin shrink-0 text-text-tertiary" width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
            <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
        {rightIcon && !loading && (
          <span className="shrink-0 text-text-tertiary" aria-hidden>
            {rightIcon}
          </span>
        )}
        {rightElement}
      </div>
    );
  }
);

Input.displayName = "Input";

// ─── FIELD WRAPPER ────────────────────────────────────────────────────────────
// Full form field: label + input + helper/error text

export interface FieldProps {
  label?: string;
  labelFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}

function Field({
  label,
  labelFor,
  hint,
  error,
  required,
  optional,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={labelFor}
          className="text-label-sm font-medium text-text-primary flex items-center gap-1.5"
        >
          {label}
          {required && <span className="text-error-text" aria-label="required">*</span>}
          {optional && <span className="text-text-tertiary font-normal">(optional)</span>}
        </label>
      )}
      {children}
      {(hint || error) && (
        <p
          className={cn(
            "text-caption-md",
            error ? "text-error-text" : "text-text-tertiary"
          )}
          role={error ? "alert" : undefined}
          aria-live={error ? "polite" : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

// ─── TEXTAREA ──────────────────────────────────────────────────────────────────

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "filled" | "ghost" | "error";
  resize?: "none" | "vertical" | "horizontal" | "both";
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = "default", resize = "vertical", autoResize, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? internalRef;

    const handleInput = React.useCallback(() => {
      if (!autoResize || !resolvedRef.current) return;
      const el = resolvedRef.current;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [autoResize, resolvedRef]);

    return (
      <textarea
        ref={resolvedRef}
        className={cn(
          "w-full rounded-lg border bg-bg-primary px-3 py-2.5",
          "text-body-md text-text-primary placeholder:text-text-tertiary",
          "transition-all duration-150 ease-smooth-out",
          "focus:outline-none focus:border-border-brand focus:shadow-[0_0_0_3px_rgba(var(--color-primary-alpha-16))]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          {
            "border-border":                    variant === "default",
            "bg-bg-secondary border-transparent": variant === "filled",
            "border-transparent bg-transparent": variant === "ghost",
            "border-border-error":              variant === "error",
          },
          resize === "none"       && "resize-none",
          resize === "vertical"   && "resize-y",
          resize === "horizontal" && "resize-x",
          resize === "both"       && "resize",
          className
        )}
        onInput={handleInput}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Input, Field, Textarea, inputWrapperVariants };
