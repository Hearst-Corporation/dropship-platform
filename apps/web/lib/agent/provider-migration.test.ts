import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Provider-migration invariant (June 2026): the entire agent runtime calls
 * OpenAI through trackedMessage() / trackedOpenAIMessage(), both of which read
 * process.env.OPENAI_API_KEY. This test guards against the class of regression
 * found in the total audit: a call site that gates real LLM work on
 * process.env.ANTHROPIC_API_KEY — a variable prod no longer sets — which
 * silently short-circuits store creation to hardcoded FALLBACK output even
 * though OpenAI is fully configured. The suite masked it before because
 * test/setup-msw.ts stubs ANTHROPIC_API_KEY; these assertions read source
 * directly so they cannot be masked by env stubs.
 */
const dir = fileURLToPath(new URL('./', import.meta.url));

// Every file that guards an LLM call on an env var must guard on OPENAI_API_KEY.
const GATED_FILES = ['landing-writer.ts', 'asset-generator.ts', 'asset-regenerator.ts'];

describe('agent LLM provider migration (OpenAI-only runtime)', () => {
  for (const f of GATED_FILES) {
    it(`${f} gates generation on OPENAI_API_KEY, not the removed ANTHROPIC_API_KEY`, () => {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, `${f} must not gate on process.env.ANTHROPIC_API_KEY`).not.toMatch(
        /process\.env\.ANTHROPIC_API_KEY/,
      );
      expect(src, `${f} must gate on process.env.OPENAI_API_KEY`).toMatch(
        /process\.env\.OPENAI_API_KEY/,
      );
    });
  }

  // The two runtime wrappers must be server-only and require the key server-side
  // (secret never crosses the client boundary; no silent keyless run).
  for (const f of ['anthropic.ts', 'openai-agent.ts']) {
    it(`${f} is server-only and requires OPENAI_API_KEY at call time`, () => {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, `${f} must import 'server-only'`).toMatch(/import\s+['"]server-only['"]/);
      expect(src, `${f} must read process.env.OPENAI_API_KEY`).toMatch(
        /process\.env\.OPENAI_API_KEY/,
      );
    });
  }
});
