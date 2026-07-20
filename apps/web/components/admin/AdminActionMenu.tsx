"use client";

import type React from "react";
import { EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from "@/components/ui/dropdown";

/**
 * Kebab (…) action menu for admin table rows and headers. Renders a Catalyst
 * Dropdown; each action becomes a link (if `href`) or a button (if `onClick`).
 * Client component (Headless UI Menu). Dark-mode aware via Catalyst.
 */
export interface AdminActionMenuAction {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface AdminActionMenuProps {
  actions: AdminActionMenuAction[];
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
  /** Dropdown anchor position. Default 'bottom end'. */
  anchor?:
    | "bottom"
    | "bottom start"
    | "bottom end"
    | "top"
    | "top start"
    | "top end";
}

export function AdminActionMenu({
  actions,
  ariaLabel = "Actions",
  anchor = "bottom end",
}: AdminActionMenuProps) {
  return (
    <Dropdown>
      <DropdownButton plain aria-label={ariaLabel}>
        <EllipsisHorizontalIcon className="size-5 text-zinc-500 text-zinc-400" />
      </DropdownButton>
      <DropdownMenu anchor={anchor}>
        {actions.map((action, index) => {
          const Icon = action.icon;
          if (action.href && !action.disabled) {
            return (
              <DropdownItem key={`${action.label}-${index}`} href={action.href}>
                {Icon ? <Icon data-slot="icon" /> : null}
                <DropdownLabel>{action.label}</DropdownLabel>
              </DropdownItem>
            );
          }
          return (
            <DropdownItem
              key={`${action.label}-${index}`}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {Icon ? <Icon data-slot="icon" /> : null}
              <DropdownLabel>{action.label}</DropdownLabel>
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
}
