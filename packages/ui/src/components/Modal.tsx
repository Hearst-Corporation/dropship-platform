"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

// ─── OVERLAY ──────────────────────────────────────────────────────────────────

const ModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-overlay bg-bg-overlay backdrop-blur-glass-sm",
      "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
      "motion-reduce:animate-none",
      className
    )}
    {...props}
  />
));
ModalOverlay.displayName = "ModalOverlay";

// ─── CONTENT VARIANTS ────────────────────────────────────────────────────────

const modalContentVariants = cva(
  [
    "fixed z-modal",
    "bg-bg-primary text-text-primary",
    "border border-border shadow-overlay",
    "flex flex-col",
    "focus:outline-none",
    "data-[state=open]:animate-scale-in data-[state=closed]:animate-fade-out",
    "motion-reduce:animate-none",
  ],
  {
    variants: {
      size: {
        xs:   "w-full max-w-xs rounded-2xl",
        sm:   "w-full max-w-sm rounded-2xl",
        md:   "w-full max-w-md rounded-2xl",
        lg:   "w-full max-w-lg rounded-2xl",
        xl:   "w-full max-w-xl rounded-2xl",
        "2xl":"w-full max-w-2xl rounded-2xl",
        "3xl":"w-full max-w-3xl rounded-2xl",
        full: "w-[calc(100%-2rem)] rounded-2xl",
      },
      position: {
        center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        top:    "left-1/2 top-8 -translate-x-1/2",
        bottom: "left-1/2 bottom-8 -translate-x-1/2",
      },
    },
    defaultVariants: {
      size: "md",
      position: "center",
    },
  }
);

// ─── CONTENT ─────────────────────────────────────────────────────────────────

interface ModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof modalContentVariants> {
  showClose?: boolean;
  closeLabel?: string;
}

const ModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(({ className, children, size, position, showClose = true, closeLabel = "Close", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <ModalOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(modalContentVariants({ size, position }), className)}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close
          className={cn(
            "absolute right-4 top-4 flex items-center justify-center",
            "h-7 w-7 rounded-lg text-text-tertiary",
            "hover:bg-interactive-hover hover:text-text-primary",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:shadow-focus",
          )}
          aria-label={closeLabel}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M11.78 4.22a.75.75 0 010 1.06L8.56 7.5l3.22 3.22a.75.75 0 11-1.06 1.06L7.5 8.56l-3.22 3.22a.75.75 0 01-1.06-1.06L6.44 7.5 3.22 4.28a.75.75 0 011.06-1.06L7.5 6.44l3.22-3.22a.75.75 0 011.06 0z" />
          </svg>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ModalContent.displayName = "ModalContent";

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const ModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1 p-6 pb-0 pr-12", className)} {...props} />
);
ModalHeader.displayName = "ModalHeader";

const ModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-heading-md font-semibold text-text-primary leading-snug", className)}
    {...props}
  />
));
ModalTitle.displayName = "ModalTitle";

const ModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-body-sm text-text-secondary mt-1", className)}
    {...props}
  />
));
ModalDescription.displayName = "ModalDescription";

const ModalBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex-1 overflow-y-auto p-6", className)} {...props} />
);
ModalBody.displayName = "ModalBody";

const ModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-end gap-3 p-6 pt-0",
      "border-t border-border-subtle mt-2 pt-4",
      className
    )}
    {...props}
  />
);
ModalFooter.displayName = "ModalFooter";

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

const Modal = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalClose = DialogPrimitive.Close;

export {
  Modal,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalOverlay,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
};
