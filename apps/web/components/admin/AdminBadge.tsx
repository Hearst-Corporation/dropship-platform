import type React from 'react'
import { Badge } from '@/components/catalyst/badge'

type BadgeColor = React.ComponentProps<typeof Badge>['color']

/**
 * Semantic status badge. Maps a status string (case-insensitive) to a Catalyst
 * <Badge> color. Falls back to zinc for unknown values. Server-safe.
 *
 * Use `statusColor()` if you need the raw color for a different primitive.
 */
export interface AdminBadgeProps {
  status: string
  /** Override the displayed label; defaults to the status string itself. */
  children?: React.ReactNode
}

const POSITIVE = new Set([
  'active',
  'actif',
  'online',
  'en ligne',
  'published',
  'publié',
  'live',
  'ready',
  'prêt',
  'success',
  'succès',
  'succeeded',
  'completed',
  'terminé',
  'done',
  'ok',
  'connected',
  'connecté',
  'paid',
  'payé',
])

const PENDING = new Set([
  'draft',
  'brouillon',
  'pending',
  'en attente',
  'creating',
  'création',
  'processing',
  'en cours',
  'running',
  'queued',
  'warning',
  'partial',
  'partiel',
])

const NEGATIVE = new Set([
  'error',
  'erreur',
  'failed',
  'failure',
  'échec',
  'échoué',
  'danger',
  'critical',
  'critique',
  'rejected',
  'rejeté',
  'cancelled',
  'canceled',
  'annulé',
  'refunded',
  'remboursé',
])

const NEUTRAL = new Set([
  'paused',
  'en pause',
  'offline',
  'hors ligne',
  'inactive',
  'inactif',
  'disabled',
  'désactivé',
  'archived',
  'archivé',
  'unknown',
  'inconnu',
])

/** Resolve a semantic status string to a Catalyst Badge color. */
export function statusColor(status: string): BadgeColor {
  const key = status.trim().toLowerCase()
  if (POSITIVE.has(key)) return 'lime'
  if (PENDING.has(key)) return 'amber'
  if (NEGATIVE.has(key)) return 'red'
  if (NEUTRAL.has(key)) return 'zinc'
  return 'zinc'
}

export function AdminBadge({ status, children }: AdminBadgeProps) {
  return <Badge color={statusColor(status)}>{children ?? status}</Badge>
}
