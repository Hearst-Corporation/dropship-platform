import type React from "react";
import { Badge } from "@/components/catalyst/badge";

type BadgeColor = React.ComponentProps<typeof Badge>["color"];

/**
 * Semantic status badge. Maps a status string (case-insensitive) to a Catalyst
 * <Badge> color. Falls back to zinc for unknown values. Server-safe.
 *
 * Use `statusColor()` if you need the raw color for a different primitive.
 */
export interface AdminBadgeProps {
  status: string;
  /** Override the displayed label; defaults to the status string itself. */
  children?: React.ReactNode;
}

const POSITIVE = new Set([
  "active",
  "actif",
  "online",
  "en ligne",
  "published",
  "publié",
  "live",
  "ready",
  "prêt",
  "success",
  "succès",
  "succeeded",
  "completed",
  "terminé",
  "done",
  "ok",
  "connected",
  "connecté",
  "paid",
  "payé",
  "payée",
  "payee",
  "captured",
  "authorized",
  "prêt à vendre",
  "envoyée",
  "sent",
  "en cours",
]);

/**
 * Resolve a semantic status string to a Catalyst Badge color.
 *
 * Single-accent policy: the ONLY hue allowed in the admin is the accent
 * ('indigo'). Positive/active states map to 'indigo'; every other state
 * (pending, error, warning, danger, neutral, unknown) maps to neutral 'zinc'.
 * Error/warning states are disambiguated by their LABEL TEXT, never by color.
 */
export function statusColor(status: string): BadgeColor {
  const key = status.trim().toLowerCase();
  if (POSITIVE.has(key)) return "indigo";
  return "zinc";
}

export function AdminBadge({ status, children }: AdminBadgeProps) {
  return <Badge color={statusColor(status)}>{children ?? status}</Badge>;
}
