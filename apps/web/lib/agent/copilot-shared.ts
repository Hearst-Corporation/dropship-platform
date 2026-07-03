/**
 * Shared copilot utilities — message rebuild, tool-use helpers, DB access,
 * and common types used by all five copilot modes (research, curation, ads,
 * medias, dev).
 *
 * Extracted from the individual copilot files to eliminate copy-paste drift.
 * Every mode stores history in its own table (research uses
 * dropship_research_messages, the per-store hub — curation/ads/medias/dev —
 * uses dropship_copilot_messages), but the Anthropic message reconstruction
 * logic is identical, and the dropship_copilot_messages read/write helpers
 * are byte-for-byte identical across the per-store modes, so they live here
 * too (`loadCopilotHistory` / `insertCopilotMessage`).
 */

import type Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';

// ── Types ───────────────────────────────────────────────────────────────

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  created_at: string;
}

export interface StoreContext {
  id: string;
  slug: string;
  name: string;
  niche: string;
  mode: 'mono' | 'collection' | null;
  medusa_sales_channel_id: string | null;
  product_count: number;
}

export interface ToolExecutionResult {
  output: unknown;
  /** Compact human-readable summary shown in the chat tool card. */
  summary: string;
  /** True if the catalog changed (UI should re-fetch product list). */
  mutated?: boolean;
}

// ── Message rebuild (Anthropic format) ──────────────────────────────────

export function stripToolUseId(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input ?? {};
  const clone = { ...(input as Record<string, unknown>) };
  delete clone.__tool_use_id;
  return clone;
}

export function stringifyToolOutput(out: unknown): string {
  if (out == null) return '';
  if (typeof out === 'string') return out;
  try {
    return JSON.stringify(out);
  } catch {
    return String(out);
  }
}

/**
 * Re-hydrate stored chat rows into Anthropic message blocks.
 *
 * Stored rows are flat (`user|assistant|tool`); the Anthropic schema groups
 * tool_use + tool_result into separate assistant/user turns. We reconstruct
 * that pairing by treating sequences of `tool` rows that immediately follow
 * an `assistant` row as the matching tool_result blocks.
 */
export function rebuildMessages(history: StoredMessage[]): Anthropic.Messages.MessageParam[] {
  const out: Anthropic.Messages.MessageParam[] = [];

  let pendingToolUses: Array<{ id: string; name: string; input: unknown }> = [];
  let pendingAssistantText = '';

  const flushAssistant = () => {
    const blocks: Anthropic.Messages.ContentBlockParam[] = [];
    if (pendingAssistantText.trim()) {
      blocks.push({ type: 'text', text: pendingAssistantText });
    }
    for (const tu of pendingToolUses) {
      blocks.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input ?? {} });
    }
    if (blocks.length) out.push({ role: 'assistant', content: blocks });
    pendingAssistantText = '';
    pendingToolUses = [];
  };

  for (const row of history) {
    if (row.role === 'user') {
      flushAssistant();
      out.push({ role: 'user', content: row.content });
    } else if (row.role === 'assistant') {
      flushAssistant();
      pendingAssistantText = row.content;
    } else if (row.role === 'tool') {
      const useId =
        row.tool_input &&
        typeof row.tool_input === 'object' &&
        '__tool_use_id' in row.tool_input
          ? String((row.tool_input as { __tool_use_id?: unknown }).__tool_use_id)
          : `toolu_${row.id}`;
      pendingToolUses.push({
        id: useId,
        name: row.tool_name ?? 'unknown',
        input: stripToolUseId(row.tool_input),
      });
      flushAssistant();
      out.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: useId,
            content: stringifyToolOutput(row.tool_output),
            is_error: Boolean(
              row.tool_output &&
                typeof row.tool_output === 'object' &&
                'error' in (row.tool_output as Record<string, unknown>) &&
                (row.tool_output as { error?: unknown }).error,
            ),
          },
        ],
      });
    }
  }
  flushAssistant();
  return out;
}

/**
 * Build the is_error flag from a tool output value. Used by both the
 * rebuild path and the live loop when constructing tool_result blocks.
 */
export function isToolError(output: unknown): boolean {
  return Boolean(
    output &&
      typeof output === 'object' &&
      'error' in (output as Record<string, unknown>) &&
      (output as { error?: unknown }).error,
  );
}

// ── DB access (dropship_copilot_messages / dropship_copilot_sessions) ────
//
// Shared by every per-store copilot mode (curation, ads, medias). These
// were previously copy-pasted near-verbatim into each `*-copilot.ts` file.

/**
 * Load the full turn history for a copilot session from the unified
 * dropship_copilot_messages table. All per-store copilot modes (curation,
 * ads, medias) share this one table, keyed by session_id.
 */
export async function loadCopilotHistory(sessionId: string): Promise<StoredMessage[]> {
  const db = getDb();
  const { rows } = await db.query<StoredMessage>(
    `SELECT id, role, content, tool_name, tool_input, tool_output, created_at
       FROM dropship_copilot_messages
       WHERE session_id = $1
       ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return rows;
}

/**
 * Insert a message into the unified dropship_copilot_messages table and
 * touch the parent session's `updated_at`. Shared by every per-store
 * copilot mode.
 */
export async function insertCopilotMessage(
  sessionId: string,
  msg: {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolName?: string | null;
    toolInput?: unknown;
    toolOutput?: unknown;
  },
): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO dropship_copilot_messages
       (session_id, role, content, tool_name, tool_input, tool_output)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      sessionId,
      msg.role,
      msg.content,
      msg.toolName ?? null,
      msg.toolInput == null ? null : JSON.stringify(msg.toolInput),
      msg.toolOutput == null ? null : JSON.stringify(msg.toolOutput),
    ],
  );
  await db.query(
    `UPDATE dropship_copilot_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId],
  );
}

/**
 * Generic `SELECT <columns> FROM dropship_stores WHERE id = $1` helper.
 * Each copilot mode needs a different column subset from `dropship_stores`
 * (curation needs mode/product_count, ads needs slug, etc.) so callers pass
 * their own column list and row shape; this just centralizes the
 * query-building + "not found → null" boilerplate.
 */
export async function loadStoreRow<T extends Record<string, unknown>>(
  storeId: string,
  columns: readonly string[],
): Promise<T | null> {
  const db = getDb();
  const { rows } = await db.query<T>(
    `SELECT ${columns.join(', ')} FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  return rows[0] ?? null;
}
