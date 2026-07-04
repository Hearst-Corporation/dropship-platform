import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
import { runContext } from './run-context';

/**
 * Anthropic SDK wrapper that records every Claude call into
 * `dropship_ai_runs`. Wraps `messages.create()` so the call sites in the
 * agent pipeline don't have to thread logging code through every step.
 *
 * Logging is fire-and-forget — a DB hiccup must never break a store
 * creation. The cost computation is per-model, expressed in EUR using a
 * fixed USD→EUR ratio (rough enough at this volume; the day a precise
 * accounting matters, swap for a live FX feed).
 *
 * Public surface:
 *   - `trackedMessage(meta, params)` accepts the Anthropic SDK request shape
 *     and returns the Anthropic SDK response shape, but is backed by the
 *     OpenAI API (provider migration, June 2026). Call sites are unchanged.
 */

// USD per 1M tokens for each model we may call. Source: OpenAI pricing
// page snapshot June 2026. Add new model IDs as we adopt them.
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  // Placeholder pricing — update from the OpenAI pricing page once gpt-5.4's
  // public rate is confirmed; until then cost tracking under-/over-estimates
  // this model's ledger rows but token counts remain accurate.
  'gpt-5.4': { input: 2.5, output: 10.0 },
  // Legacy Claude ids kept so historical ledger rows still price.
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
};

// Conservative USD→EUR. Override at runtime via env if needed.
const USD_TO_EUR = Number(process.env.USD_TO_EUR ?? '0.92');

// ── Provider: OpenAI official API (migrated off Anthropic/Moonshot, June 2026) ──
// trackedMessage keeps the Anthropic SDK request/response SHAPE so the 14 call
// sites are unchanged, but the actual call goes to OpenAI /chat/completions.
// We translate params (messages/system/tools) → OpenAI and rebuild a synthetic
// Anthropic.Messages.Message (text + tool_use blocks) from the OpenAI response.
const OPENAI_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return key;
}

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: string; url?: string; media_type?: string; data?: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown };

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: 'text'; text: string } => (b as { type?: string })?.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }
  return '';
}

/**
 * Translate Anthropic-shape params into an OpenAI chat/completions body.
 *
 * Exported for unit testing: the Anthropic->OpenAI message conversion must
 * preserve OpenAI's tool-call invariant (every role:'tool' message directly
 * follows the assistant message whose tool_calls include its tool_call_id).
 */
export function toOpenAIBody(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
): Record<string, unknown> {
  const messages: Array<Record<string, unknown>> = [];

  if (params.system) {
    messages.push({ role: 'system', content: textFromContent(params.system) });
  }

  for (const m of params.messages) {
    const blocks = Array.isArray(m.content) ? (m.content as AnthropicBlock[]) : null;
    if (!blocks) {
      messages.push({ role: m.role, content: String(m.content) });
      continue;
    }
    if (m.role === 'assistant') {
      const text = blocks
        .filter((b): b is Extract<AnthropicBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const toolCalls = blocks
        .filter((b): b is Extract<AnthropicBlock, { type: 'tool_use' }> => b.type === 'tool_use')
        .map((b) => ({
          id: b.id,
          type: 'function' as const,
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));
      const msg: Record<string, unknown> = { role: 'assistant', content: text || null };
      if (toolCalls.length > 0) msg.tool_calls = toolCalls;
      messages.push(msg);
    } else {
      // user role — split out tool_result blocks into OpenAI 'tool' messages,
      // and translate text + image blocks into OpenAI user content.
      const toolResults = blocks.filter(
        (b): b is Extract<AnthropicBlock, { type: 'tool_result' }> => b.type === 'tool_result',
      );
      const textParts = blocks
        .filter((b): b is Extract<AnthropicBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const imageBlocks = blocks.filter(
        (b): b is Extract<AnthropicBlock, { type: 'image' }> => b.type === 'image',
      );

      // OpenAI invariant: every role:'tool' message MUST directly follow the
      // assistant message that carried its matching tool_calls, with NOTHING
      // in between. Anthropic groups tool_result blocks together with any
      // follow-up text/image blocks in the SAME user turn, so we must emit the
      // 'tool' messages FIRST (right after the assistant tool_calls) and only
      // then any user text/image content. Emitting text first inserts a user
      // message between the tool_calls and their responses, which triggers
      // "messages with role 'tool' must be a response to a preceding message
      // with tool_calls" and breaks every multi-turn tool loop. (Bug fix, June
      // 2026 — was the cause of the copilots/super-agent tool-loop crash.)
      for (const tr of toolResults) {
        messages.push({
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
        });
      }

      if (imageBlocks.length > 0) {
        const parts: Array<Record<string, unknown>> = [];
        if (textParts) parts.push({ type: 'text', text: textParts });
        for (const img of imageBlocks) {
          const url =
            img.source.url ??
            (img.source.data
              ? `data:${img.source.media_type ?? 'image/jpeg'};base64,${img.source.data}`
              : '');
          if (url) parts.push({ type: 'image_url', image_url: { url } });
        }
        messages.push({ role: 'user', content: parts });
      } else if (textParts) {
        messages.push({ role: 'user', content: textParts });
      }
    }
  }

  // Call sites pass an Anthropic-shaped `model` id (e.g. RESEARCH_MODEL);
  // honor it when it's a real OpenAI id we have pricing for, otherwise fall
  // back to the global default. Previously this always ignored
  // params.model, so every call site silently ran on OPENAI_MODEL
  // regardless of what it requested.
  const model = params.model && PRICING[params.model] ? params.model : OPENAI_MODEL;

  const body: Record<string, unknown> = { model, messages };
  // Newer OpenAI models (gpt-5.x and the o-series reasoning models) reject
  // `max_tokens` outright and require `max_completion_tokens` instead; older
  // chat-completions models (gpt-4o family) only accept `max_tokens`.
  if (/^(gpt-5|o[0-9])/.test(model)) {
    body.max_completion_tokens = params.max_tokens;
  } else {
    body.max_tokens = params.max_tokens;
  }
  if (typeof params.temperature === 'number') body.temperature = params.temperature;

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((t) => {
      const tool = t as { name: string; description?: string; input_schema?: unknown };
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description ?? '',
          parameters: tool.input_schema ?? { type: 'object', properties: {} },
        },
      };
    });
    const tc = params.tool_choice as { type?: string; name?: string } | undefined;
    if (tc?.type === 'tool' && tc.name) {
      body.tool_choice = { type: 'function', function: { name: tc.name } };
    } else if (tc?.type === 'any') {
      body.tool_choice = 'required';
    } else {
      body.tool_choice = 'auto';
    }
  }

  return body;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; type?: string };
}

/** Rebuild a synthetic Anthropic.Messages.Message from an OpenAI response. */
function toAnthropicMessage(
  data: OpenAIChatResponse,
  model: string,
): Anthropic.Messages.Message {
  const choice = data.choices?.[0];
  const msg = choice?.message;
  const content: Anthropic.Messages.ContentBlock[] = [];
  const makeText = (text: string): Anthropic.Messages.TextBlock => ({
    type: 'text',
    text,
    citations: null,
  });
  if (msg?.content) content.push(makeText(msg.content));
  for (const tc of msg?.tool_calls ?? []) {
    let input: unknown = {};
    try {
      input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
    } catch {
      input = {};
    }
    const toolUse: Anthropic.Messages.ToolUseBlock = {
      type: 'tool_use',
      id: tc.id,
      name: tc.function.name,
      input,
      caller: { type: 'direct' },
    };
    content.push(toolUse);
  }
  if (content.length === 0) content.push(makeText(''));

  const hasToolUse = (msg?.tool_calls?.length ?? 0) > 0;
  const stopReason = hasToolUse
    ? 'tool_use'
    : choice?.finish_reason === 'length'
      ? 'max_tokens'
      : 'end_turn';

  return {
    id: `openai_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stopReason as Anthropic.Messages.Message['stop_reason'],
    stop_sequence: null,
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    } as Anthropic.Messages.Usage,
  } as Anthropic.Messages.Message;
}

export interface RunMeta {
  /** UUID of the store this call is part of, when known. Null for
   *  exploratory calls (eg. niche validator that runs before a store
   *  exists). */
  storeId?: string | null;
  /** Free-form label used in the ledger and the dashboard: 'generate',
   *  'enrich', 'vision-score', 'prompt-build', etc. */
  step: string;
}

/**
 * Compute the EUR cost of a single call from the response usage block.
 * Models we don't know about return 0 — the ledger still records token
 * counts, so the cost backfill is a single UPDATE if pricing changes.
 */
export function computeCostEur(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  const usd = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  return Number((usd * USD_TO_EUR).toFixed(6));
}

interface InsertArgs {
  storeId: string | null;
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costEur: number;
  errorJson: string | null;
}

async function insertRun(args: InsertArgs): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `INSERT INTO dropship_ai_runs
         (store_id, step, model, input_tokens, output_tokens, latency_ms, cost_eur, error_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        args.storeId,
        args.step,
        args.model,
        args.inputTokens,
        args.outputTokens,
        args.latencyMs,
        args.costEur,
        args.errorJson,
      ],
    );
  } catch (e) {
    // Audit failure must never propagate. Log to stderr for Sentry pickup.
    console.error('[anthropic-tracked] insertRun failed', e);
  }
}

// ── Retry + timeout layer ───────────────────────────────────────────────

const MAX_RETRIES = 3;
const TIMEOUT_MS = 60_000;

function isRetryableStatus(status: number, message: string): boolean {
  if (status === 429) return true;
  if (status >= 500) return true;
  if (/network|timeout|abort|fetch/i.test(message)) return true;
  return false;
}

async function callWithRetry(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Messages.Message> {
  const body = toOpenAIBody(params);
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${getOpenAIKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as OpenAIChatResponse;
      if (!res.ok || data.error) {
        const msg = data.error?.message || `OpenAI HTTP ${res.status}`;
        if (!isRetryableStatus(res.status, msg) || attempt === MAX_RETRIES - 1) {
          throw new Error(msg);
        }
        lastError = new Error(msg);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      return toAnthropicMessage(data, body.model as string);
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!isRetryableStatus(0, msg) || attempt === MAX_RETRIES - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastError;
}

/**
 * trackedMessage — drop-in for `anthropic.messages.create()`, now backed by
 * the OpenAI API. Returns the Anthropic SDK response shape so call sites are
 * unchanged. Errors are re-thrown unchanged after being recorded.
 */
export async function trackedMessage(
  meta: RunMeta,
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Messages.Message> {
  const startedAt = Date.now();
  // Resolve up front the same way toOpenAIBody() does, so the ledger records
  // the model that was actually requested for the call even if it errors
  // before a response comes back (response.model covers the success path).
  const requestedModel =
    params.model && PRICING[params.model] ? params.model : OPENAI_MODEL;
  let response: Anthropic.Messages.Message | null = null;
  let errorJson: string | null = null;
  try {
    response = await callWithRetry(params);
    return response;
  } catch (e) {
    errorJson = JSON.stringify({
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : null,
      stack: e instanceof Error ? e.stack?.split('\n').slice(0, 6).join('\n') ?? null : null,
    });
    throw e;
  } finally {
    const model = response?.model ?? requestedModel;
    const latencyMs = Date.now() - startedAt;
    const inputTokens = response?.usage?.input_tokens ?? 0;
    const outputTokens = response?.usage?.output_tokens ?? 0;
    const costEur = computeCostEur(model, inputTokens, outputTokens);
    // Fire-and-forget: do not await, do not block the agent on the audit
    // write. The promise rejection is swallowed inside insertRun.
    const ambientStoreId = runContext.getStore()?.storeId ?? null;
    void insertRun({
      storeId: meta.storeId ?? ambientStoreId,
      step: meta.step,
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      costEur,
      errorJson,
    });
  }
}
