import clsx from "clsx";
import type React from "react";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/16/solid";
import { adminText, adminTextMuted } from "./admin-surface";

/**
 * Compact KPI card for the admin dashboard. Shows a label, a big value, an
 * optional hint line, an optional colored delta chip, and an optional icon.
 * Dark-mode aware. Server-safe.
 */
type Tone = "default" | "positive" | "warning" | "danger";

export interface AdminStatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: { value: string; positive?: boolean };
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  chart?: React.ReactNode;
}

const toneValue: Record<Tone, string> = {
  default: adminText,
  positive: "text-indigo-400",
  warning: "text-amber-400",
  danger: "text-red-400",
};

const toneIconWrap: Record<Tone, string> = {
  default: adminTextMuted,
  positive: "text-indigo-400",
  warning: "text-amber-400",
  danger: "text-red-400",
};

export function AdminStatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = "default",
  chart,
}: AdminStatCardProps) {
  return (
    <div className="group relative flex-col justify-between overflow-hidden p-6">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <p
            className={clsx(
              "truncate text-[10px] font-bold uppercase tracking-[0.15em]",
              adminTextMuted,
            )}
          >
            {label}
          </p>
          {Icon ? (
            <span
              className={clsx(
                "flex size-6 shrink-0 items-center justify-end",
                toneIconWrap[tone],
              )}
            >
              <Icon className="size-4" />
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span
            className={clsx(
              "text-3xl font-bold tracking-tight tabular-nums",
              toneValue[tone],
            )}
          >
            {value}
          </span>
          {delta ? (
            <span
              className={clsx(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-bold tabular-nums",
                delta.positive ? "text-indigo-400" : adminTextMuted,
              )}
            >
              {delta.positive ? (
                <ArrowTrendingUpIcon className="size-3.5" />
              ) : (
                <ArrowTrendingDownIcon className="size-3.5" />
              )}
              {delta.value}
            </span>
          ) : null}
        </div>
        {hint ? (
          <p
            className={clsx(
              "mt-2 truncate text-xs font-medium",
              adminTextMuted,
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>
      {chart ? (
        <div className="absolute inset-x-0 bottom-0 z-0 h-16 opacity-40">
          {chart}
        </div>
      ) : null}
    </div>
  );
}
