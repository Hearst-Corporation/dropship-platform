/**
 * Regression tests for the Anthropic->OpenAI message conversion in the agent
 * loop (lib/agent/anthropic.ts).
 *
 * Bug (prod, dropship_ai_runs 2026-06-30): the OpenAI API rejected multi-turn
 * tool-using conversations with
 *
 *   "Invalid parameter: messages with role 'tool' must be a response to a
 *    preceding message with tool_calls"
 *
 * OpenAI's invariant: every `{ role:'tool', tool_call_id }` message MUST be
 * emitted immediately after the assistant message whose `tool_calls` include
 * that `tool_call_id`, with NOTHING between the assistant tool_calls and their
 * tool responses (other tool responses from the same assistant turn are fine).
 *
 * The converter used to emit the user's follow-up text/image content BEFORE the
 * tool responses. When an Anthropic user turn carried both tool_result blocks
 * AND text/image blocks (which Anthropic groups in the same turn), that text got
 * inserted between the assistant tool_calls and the tool responses, breaking the
 * invariant and crashing every copilot / super-agent tool loop.
 *
 * These tests assert the invariant both on the pure converter (toOpenAIBody)
 * and end-to-end through trackedMessage() with a recording MSW handler that
 * captures the actual body POSTed to OpenAI.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/setup-msw';

// getDb() is only touched by the fire-and-forget ledger write; stub it so the
// converter/trackedMessage tests never open a real Postgres connection.
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    query: () => Promise.resolve({ rows: [], rowCount: 1 }),
  }),
  getDbRead: () => ({
    query: () => Promise.resolve({ rows: [], rowCount: 0 }),
  }),
}));

import { toOpenAIBody, trackedMessage } from './anthropic';

// ── OpenAI message shape + invariant checker ────────────────────────────────

interface OpenAIToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: unknown;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

/**
 * Returns a list of invariant violations. Empty = valid for OpenAI.
 *
 * A role:'tool' message is valid iff, walking back over any run of preceding
 * tool messages, the first non-tool message is an assistant whose tool_calls
 * contain this message's tool_call_id. This is exactly what triggers the prod
 * error "messages with role 'tool' must be a response to a preceding message
 * with tool_calls" when violated.
 */
function findToolInvariantViolations(messages: OpenAIMessage[]): string[] {
  const problems: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== 'tool') continue;

    // Walk back over consecutive tool messages to reach the assistant turn.
    let j = i - 1;
    while (j >= 0 && messages[j]!.role === 'tool') j--;
    const anchor = messages[j];

    if (
      !anchor ||
      anchor.role !== 'assistant' ||
      !Array.isArray(anchor.tool_calls) ||
      !anchor.tool_calls.some((tc) => tc.id === m.tool_call_id)
    ) {
      problems.push(
        `messages[${i}] role:'tool' tool_call_id=${String(
          m.tool_call_id,
        )} is NOT a response to a preceding assistant.tool_calls ` +
          `(anchor role=${anchor?.role ?? 'none'}, anchor tool_calls=${JSON.stringify(
            anchor?.tool_calls?.map((t) => t.id) ?? null,
          )})`,
      );
    }
  }
  return problems;
}

/** Convenience: extract the OpenAI messages array out of a converted body. */
function convert(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
): OpenAIMessage[] {
  return toOpenAIBody(params).messages as OpenAIMessage[];
}

// ── Anthropic-shape fixtures ────────────────────────────────────────────────

/**
 * The exact history shape the task calls out:
 *   [user, assistant(tool_use A), user(tool_result A),
 *          assistant(tool_use B), user(tool_result B), ...]
 * plus the two shapes that actually broke prod:
 *   - a single assistant turn with PARALLEL tool_use (A + B), answered by a
 *     single user turn carrying both tool_result blocks;
 *   - a user turn carrying tool_result blocks AND trailing text.
 */
function multiTurnToolConversation(): Anthropic.Messages.MessageParam[] {
  return [
    { role: 'user', content: 'Analyse la niche yoga et propose des produits.' },
    // Assistant turn 1: text + two PARALLEL tool_use blocks.
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Je lance deux recherches en parallèle.' },
        { type: 'tool_use', id: 'call_meta', name: 'meta_ads_library', input: { niche: 'yoga' } },
        { type: 'tool_use', id: 'call_ae', name: 'aliexpress_search', input: { query: 'tapis yoga' } },
      ] as Anthropic.Messages.ContentBlockParam[],
    },
    // User turn 1: BOTH tool_result blocks AND a trailing text note in the same
    // turn — this is the shape that used to inject a user message between the
    // assistant tool_calls and their tool responses.
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call_meta',
          content: '{"saturation":42}',
          is_error: false,
        },
        {
          type: 'tool_result',
          tool_use_id: 'call_ae',
          content: '{"candidates":[{"id":"ae1"}]}',
          is_error: false,
        },
        { type: 'text', text: 'Concentre-toi sur les tapis premium.' },
      ] as Anthropic.Messages.ContentBlockParam[],
    },
    // Assistant turn 2: a single follow-up tool_use.
    {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'call_score', name: 'score_products', input: { top: 3 } },
      ] as Anthropic.Messages.ContentBlockParam[],
    },
    // User turn 2: its tool_result.
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call_score',
          content: '{"scored":3}',
          is_error: false,
        },
      ] as Anthropic.Messages.ContentBlockParam[],
    },
  ];
}

const SUPER_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'meta_ads_library',
    description: 'x',
    input_schema: { type: 'object', properties: { niche: { type: 'string' } } },
  },
  {
    name: 'aliexpress_search',
    description: 'x',
    input_schema: { type: 'object', properties: { query: { type: 'string' } } },
  },
  {
    name: 'score_products',
    description: 'x',
    input_schema: { type: 'object', properties: { top: { type: 'number' } } },
  },
];

// ── Direct converter tests ──────────────────────────────────────────────────

describe('toOpenAIBody — OpenAI tool-call invariant', () => {
  it('holds the invariant for a parallel + text-carrying multi-turn tool conversation', () => {
    const openaiMessages = convert({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'Tu es le Super Agent.',
      messages: multiTurnToolConversation(),
    });

    const violations = findToolInvariantViolations(openaiMessages);
    expect(violations).toEqual([]);
  });

  it('emits every tool response DIRECTLY after its assistant tool_calls (no user text in between)', () => {
    const openaiMessages = convert({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: multiTurnToolConversation(),
    });

    // Locate the assistant that issued the two parallel calls.
    const parallelAssistantIdx = openaiMessages.findIndex(
      (m) =>
        m.role === 'assistant' &&
        Array.isArray(m.tool_calls) &&
        m.tool_calls.some((tc) => tc.id === 'call_meta') &&
        m.tool_calls.some((tc) => tc.id === 'call_ae'),
    );
    expect(parallelAssistantIdx).toBeGreaterThanOrEqual(0);

    // The next two messages must be the two tool responses, back to back.
    const next1 = openaiMessages[parallelAssistantIdx + 1]!;
    const next2 = openaiMessages[parallelAssistantIdx + 2]!;
    expect(next1.role).toBe('tool');
    expect(next2.role).toBe('tool');
    expect([next1.tool_call_id, next2.tool_call_id].sort()).toEqual(
      ['call_ae', 'call_meta'].sort(),
    );

    // The trailing user text is emitted AFTER the tool responses, not before.
    const trailing = openaiMessages[parallelAssistantIdx + 3]!;
    expect(trailing.role).toBe('user');
    expect(trailing.content).toContain('tapis premium');
  });

  it('never produces a role:tool message immediately preceded by a role:user message', () => {
    const openaiMessages = convert({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: multiTurnToolConversation(),
    });
    for (let i = 1; i < openaiMessages.length; i++) {
      if (openaiMessages[i]!.role === 'tool') {
        expect(openaiMessages[i - 1]!.role).not.toBe('user');
      }
    }
  });
});

// ── End-to-end through trackedMessage with a recording MSW handler ──────────

describe('trackedMessage — records a valid OpenAI request for a tool loop', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('POSTs a body whose tool messages satisfy the invariant', async () => {
    const captured: { body: { messages: OpenAIMessage[] } | null } = { body: null };

    server.use(
      http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
        captured.body = (await request.json()) as { messages: OpenAIMessage[] };
        // Minimal well-formed completion so trackedMessage resolves.
        return HttpResponse.json({
          id: 'chatcmpl_tool_loop_test',
          object: 'chat.completion',
          model: 'gpt-4o',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'Terminé.' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });
      }),
    );

    await trackedMessage(
      { step: 'tool-loop-regression', storeId: null },
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'Tu es le Super Agent.',
        tools: SUPER_TOOLS,
        messages: multiTurnToolConversation(),
      },
    );

    expect(captured.body).not.toBeNull();
    const messages = captured.body!.messages;

    // Every tool message is a valid response to a preceding assistant.tool_calls.
    const violations = findToolInvariantViolations(messages);
    expect(violations).toEqual([]);

    // And explicitly: no tool message is directly preceded by a user message,
    // which is exactly what triggers the prod error.
    for (let i = 1; i < messages.length; i++) {
      if (messages[i]!.role === 'tool') {
        expect(messages[i - 1]!.role).not.toBe('user');
      }
    }

    // Sanity: the recorded body actually carries the tool loop (not empty).
    expect(messages.some((m) => m.role === 'tool')).toBe(true);
    expect(
      messages.some((m) => m.role === 'assistant' && Array.isArray(m.tool_calls)),
    ).toBe(true);
  });
});
