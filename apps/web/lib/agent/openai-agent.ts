/**
 * OpenAI agent wrapper for the store-creator + super-agent pipelines.
 *
 * Provider migrated to the official OpenAI API (June 2026). Uses GPT-4.1 by
 * default (long-context agent reasoning). The API is OpenAI's own, so we call
 * /chat/completions with fetch.
 *
 * The exported symbols use the `OpenAI` naming so call sites read honestly.
 * Every call is logged to `dropship_ai_runs` with the same shape as
 * `trackedMessage` so the cost dashboard stays consistent.
 */

import 'server-only';
import { getDb } from '@/lib/db';
import { runContext } from './run-context';

const API_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_AGENT_MODEL || 'gpt-4.1';
const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return key;
}

function isRetryable(status: number, message: string): boolean {
  if (status === 429) return true;
  if (status >= 500) return true;
  if (/timeout|abort|fetch|network/i.test(message)) return true;
  return false;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
      refusal?: string | null;
    };
    finish_reason: string;
    index: number;
  }>;
  usage?: OpenAIUsage;
  error?: { message: string; type: string };
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
    console.error('[openai-tracked] insertRun failed', e);
  }
}

/**
 * EUR cost for GPT-4.1 (June 2026 pricing snapshot).
 * Source: OpenAI pricing page — GPT-4.1: $2.00 / 1M input, $8.00 / 1M output.
 * If pricing changes, backfill via UPDATE on dropship_ai_runs.
 */
function computeCostEur(inputTokens: number, outputTokens: number): number {
  const USD_TO_EUR = Number(process.env.USD_TO_EUR ?? '0.92');
  const inputUsd = (inputTokens / 1_000_000) * 2.0;
  const outputUsd = (outputTokens / 1_000_000) * 8.0;
  return Number(((inputUsd + outputUsd) * USD_TO_EUR).toFixed(6));
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  // OpenAI requires content to be null on an assistant message that only
  // carries tool_calls.
  content: string | null;
  tool_call_id?: string;
  // Assistant messages that requested tools must carry the structured
  // tool_calls so the following role:'tool' messages are accepted by OpenAI.
  tool_calls?: OpenAIToolCall[];
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIRunMeta {
  storeId?: string | null;
  step: string;
}

/**
 * Drop-in replacement for `trackedMessage` tailored to the OpenAI Chat
 * Completions API. Supports optional function-calling.
 */
export async function trackedOpenAIMessage(
  meta: OpenAIRunMeta,
  messages: OpenAIMessage[],
  options?: { tools?: OpenAITool[]; maxTokens?: number; jsonMode?: boolean },
): Promise<{ text: string; usage: OpenAIUsage; tool_calls?: OpenAIToolCall[]; finishReason: string | null }> {
  const startedAt = Date.now();
  let responseText = '';
  let toolCalls: OpenAIToolCall[] | undefined;
  let finishReason: string | null = null;
  let usage: OpenAIUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let errorJson: string | null = null;

  try {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      // 4096 was too small for multi-product enrichment (12 products ×
      // 170-word descriptions truncated mid-JSON → "invalid JSON"). Default to
      // 8192 and let callers request more for large payloads.
      max_tokens: options?.maxTokens ?? 8192,
      temperature: 0.7,
    };
    if (options?.tools) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }
    // OpenAI native JSON mode: guarantees a syntactically valid JSON body.
    // Fixes the intermittent "invalid JSON" failures on French copy (unescaped
    // quotes at temperature 0.7). The prompt must mention "JSON" (API rule) —
    // every call site using this flag already does.
    if (options?.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/chat/completions`, {
          method: 'POST',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: {
            Authorization: `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as OpenAIResponse & {
          choices?: Array<{
            message?: {
              role?: string;
              content?: string | null;
              tool_calls?: OpenAIToolCall[];
            };
            finish_reason?: string | null;
          }>;
        };

        if (!res.ok || data.error) {
          const errMsg = data.error?.message || `OpenAI HTTP ${res.status}`;
          if (!isRetryable(res.status, errMsg) || attempt === MAX_RETRIES - 1) {
            throw new Error(errMsg);
          }
          lastError = new Error(errMsg);
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }

        const choice = data.choices?.[0];
        const msg = choice?.message;
        if (msg?.tool_calls && msg.tool_calls.length > 0) {
          toolCalls = msg.tool_calls;
        }
        responseText = msg?.content ?? '';
        finishReason = choice?.finish_reason ?? null;
        usage = data.usage ?? usage;
        break;
      } catch (e) {
        lastError = e;
        if (e instanceof Error && e.name === 'AbortError') {
          lastError = new Error('OpenAI timeout');
        }
        if (!isRetryable(0, e instanceof Error ? e.message : '') || attempt === MAX_RETRIES - 1) {
          throw lastError;
        }
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }

    return { text: responseText, usage, tool_calls: toolCalls, finishReason };
  } catch (e) {
    errorJson = JSON.stringify({
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : null,
    });
    throw e;
  } finally {
    const latencyMs = Date.now() - startedAt;
    const costEur = computeCostEur(usage.prompt_tokens, usage.completion_tokens);
    const ambientStoreId = runContext.getStore()?.storeId ?? null;
    void insertRun({
      storeId: meta.storeId ?? ambientStoreId,
      step: meta.step,
      model: MODEL,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      latencyMs,
      costEur,
      errorJson,
    });
  }
}
