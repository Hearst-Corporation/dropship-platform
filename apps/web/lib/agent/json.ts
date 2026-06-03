/**
 * Extract a JSON object from an LLM free-form text response.
 *
 * Handles the brittleness modes we hit on Haiku outputs:
 *   1. Markdown code fences (```json ... ``` or ``` ... ```).
 *   2. Prose before and/or after the JSON body.
 *   3. Multiple sibling JSON objects in one response (we return the first
 *      balanced one).
 *   4. Strings containing `{` or `}` that would otherwise confuse a greedy
 *      regex extractor.
 *
 * Returns `null` on failure. Callers decide whether to throw, fall back to a
 * default, or surface to Sentry. This module deliberately does no logging — it
 * is a pure parser.
 *
 * The pre-existing extraction was `text.match(/\{[\s\S]*\}/)` which is greedy
 * and picks up trailing prose when Claude appends commentary, *and* fails
 * outright when the response is wrapped in a ```json fence.
 */
export function extractJson<T = unknown>(text: string | null | undefined): T | null {
  if (!text || typeof text !== 'string') return null;

  const candidates = candidateBodies(text);
  for (const body of candidates) {
    try {
      return JSON.parse(body) as T;
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Produce parseable candidates in best-effort order:
 *   a. The full trimmed text (covers happy path).
 *   b. The content of a ```json or ``` fence, if present.
 *   c. The first balanced {…} block found in the text.
 *   d. A salvage of a truncated body — recovers complete elements emitted
 *      before the cut. Last resort, so it never overrides a clean parse.
 */
function candidateBodies(text: string): string[] {
  const out: string[] = [];
  const trimmed = text.trim();
  out.push(trimmed);

  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fence?.[1]) out.push(fence[1].trim());

  const balanced = firstBalancedObject(trimmed);
  if (balanced) out.push(balanced);

  // Strip a leading fence open (```json) before salvaging — truncation often
  // cuts the response before the closing fence so the regex above misses.
  const defenced = trimmed.replace(/^```(?:json)?\s*\n?/i, '');
  const salvaged = salvageTruncatedJson(defenced);
  if (salvaged) out.push(salvaged);

  return out;
}

/**
 * Best-effort repair of a JSON body that was cut off mid-stream (the LLM hit
 * its max_tokens ceiling). Walks the text tracking the bracket stack and string
 * state, remembers the last point where every still-open container could be
 * cleanly closed (i.e. right after a complete element), truncates there, drops a
 * dangling comma, and appends the matching closers.
 *
 * Returns a repaired JSON string, or null when nothing complete was emitted
 * (e.g. `{"unterminated": ` — no element ever closed, so there is nothing to
 * salvage). The caller still JSON.parses the result, so a bad repair is inert.
 */
function salvageTruncatedJson(s: string): string | null {
  const start = s.search(/[{[]/);
  if (start === -1) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  // The longest prefix that closes to valid JSON: index just past the last
  // bracket-close, plus the stack still open at that moment.
  let bestEnd = -1;
  let bestStack: string[] = [];

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
    } else if (c === '{' || c === '[') {
      stack.push(c);
    } else if (c === '}' || c === ']') {
      stack.pop();
      // Record only while still inside the root container — a checkpoint at
      // depth 0 means the whole thing already balanced (handled elsewhere).
      if (stack.length > 0) {
        bestEnd = i + 1;
        bestStack = [...stack];
      }
    }
  }

  if (bestEnd === -1) return null;

  let head = s.slice(start, bestEnd).replace(/[\s,]+$/, '');
  for (let i = bestStack.length - 1; i >= 0; i--) {
    head += bestStack[i] === '{' ? '}' : ']';
  }
  return head;
}

/**
 * Walk the string and return the first balanced `{...}` substring, respecting
 * JSON string literals so braces inside strings do not unbalance the count.
 */
function firstBalancedObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }

  return null;
}
