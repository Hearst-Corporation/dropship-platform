"use client";

/**
 * COMMAND PALETTE
 * Keyboard-first universal search/action UI.
 * ⌘K opens it. Sections, icons, keyboard shortcuts, recent items supported.
 * Built with CMDK under the hood.
 */

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../utils/cn";

// ─── OVERLAY + CONTAINER ──────────────────────────────────────────────────────

const CommandDialog = ({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-command bg-bg-overlay backdrop-blur-glass-sm",
          "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
          "motion-reduce:animate-none"
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-[20vh] z-command -translate-x-1/2",
          "w-full max-w-2xl rounded-2xl",
          "bg-bg-primary border border-border shadow-overlay",
          "overflow-hidden",
          "data-[state=open]:animate-slide-down data-[state=closed]:animate-fade-out",
          "motion-reduce:animate-none",
          "focus:outline-none"
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

// ─── COMMAND ROOT ──────────────────────────────────────────────────────────────

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex flex-col overflow-hidden",
      "text-text-primary",
      className
    )}
    {...props}
  />
));
Command.displayName = "Command";

// ─── SEARCH INPUT ─────────────────────────────────────────────────────────────

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
    <svg
      className="shrink-0 text-text-tertiary"
      width="18" height="18" viewBox="0 0 18 18" fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex-1 bg-transparent outline-none",
        "text-body-md text-text-primary placeholder:text-text-tertiary",
        "disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
    <kbd className="hidden sm:flex items-center gap-0.5 text-caption-sm text-text-quaternary font-mono">
      <span>esc</span>
    </kbd>
  </div>
));
CommandInput.displayName = "CommandInput";

// ─── LIST ─────────────────────────────────────────────────────────────────────

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[420px] overflow-y-auto overflow-x-hidden py-2", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="flex flex-col items-center justify-center gap-3 py-12 text-center"
    {...props}
  >
    <div className="h-12 w-12 rounded-xl bg-bg-secondary flex items-center justify-center text-text-tertiary">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9 6v6M6 9h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
    <div>
      <p className="text-body-sm font-medium text-text-primary">No results found</p>
      <p className="text-caption-md text-text-tertiary mt-0.5">Try a different search term</p>
    </div>
  </CommandPrimitive.Empty>
));
CommandEmpty.displayName = "CommandEmpty";

// ─── GROUP ────────────────────────────────────────────────────────────────────

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1.5",
      "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5",
      "[&_[cmdk-group-heading]]:text-overline-sm [&_[cmdk-group-heading]]:text-text-tertiary",
      "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest",
      className
    )}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

// ─── SEPARATOR ────────────────────────────────────────────────────────────────

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("mx-2 my-1 h-px bg-border-subtle", className)}
    {...props}
  />
));
CommandSeparator.displayName = "CommandSeparator";

// ─── ITEM ─────────────────────────────────────────────────────────────────────

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> & {
    keywords?: string[];
    shortcut?: string;
    icon?: React.ReactNode;
    description?: string;
    badge?: React.ReactNode;
  }
>(({ className, children, shortcut, icon, description, badge, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
      "text-body-sm text-text-primary",
      "select-none outline-none",
      "transition-colors duration-75",
      "data-[selected]:bg-interactive-selected data-[selected]:text-text-primary",
      "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
      "[&>svg]:text-text-tertiary [&>svg]:shrink-0",
      className
    )}
    {...props}
  >
    {icon && (
      <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-bg-secondary text-text-secondary shrink-0">
        {icon}
      </span>
    )}
    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
      <span className="truncate font-medium">{children}</span>
      {description && (
        <span className="text-caption-sm text-text-tertiary truncate">{description}</span>
      )}
    </div>
    {badge && <span className="ml-auto">{badge}</span>}
    {shortcut && (
      <kbd className="ml-auto flex gap-0.5 font-mono text-caption-sm text-text-quaternary">
        {shortcut.split("+").map((key, i) => (
          <span
            key={i}
            className="flex h-5 min-w-5 items-center justify-center rounded border border-border px-1"
          >
            {key === "cmd" ? "⌘" : key === "shift" ? "⇧" : key === "alt" ? "⌥" : key === "ctrl" ? "⌃" : key}
          </span>
        ))}
      </kbd>
    )}
  </CommandPrimitive.Item>
));
CommandItem.displayName = "CommandItem";

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function CommandFooter({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5",
        "border-t border-border text-caption-sm text-text-quaternary",
        "bg-bg-secondary",
        className
      )}
    >
      {children ?? (
        <>
          <span className="flex items-center gap-2">
            <kbd className="inline-flex h-4 items-center rounded border border-border px-1 font-mono text-[10px]">↑↓</kbd>
            navigate
            <kbd className="inline-flex h-4 items-center rounded border border-border px-1 font-mono text-[10px]">↵</kbd>
            select
          </span>
          <kbd className="inline-flex h-4 items-center rounded border border-border px-1 font-mono text-[10px]">esc</kbd>
        </>
      )}
    </div>
  );
}

export {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
  CommandItem,
  CommandFooter,
};
