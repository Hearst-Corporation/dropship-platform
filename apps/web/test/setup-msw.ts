import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { aliexpressHandlers } from './handlers/aliexpress';
import { cjHandlers } from './handlers/cj';
import { anthropicHandlers } from './handlers/anthropic';
import { medusaHandlers } from './handlers/medusa';
import { zendropHandlers } from './handlers/zendrop';
import { spocketHandlers } from './handlers/spocket';
import { bigbuyHandlers } from './handlers/bigbuy';
import { dobaHandlers } from './handlers/doba';

/**
 * Shared MSW server used by every Vitest run.
 *
 * The default handlers below describe the *production-shaped* responses we
 * expect from each external dependency in the agent pipeline. Individual
 * tests override specific handlers via `server.use(...)` for failure-mode or
 * variant scenarios; `afterEach` resets to this baseline so tests stay
 * independent.
 */
export const server = setupServer(
  ...aliexpressHandlers,
  ...cjHandlers,
  ...anthropicHandlers,
  ...medusaHandlers,
  // New suppliers — all fail-closed (401/error) so the default test run
  // yields zero products from each, keeping existing assertions intact.
  ...zendropHandlers,
  ...spocketHandlers,
  ...bigbuyHandlers,
  ...dobaHandlers,
);

beforeAll(() => {
  // Env stubs need to be in place *before* any module under test imports them
  // — `vi.stubEnv` here covers modules read at import time (medusa.ts reads
  // MEDUSA_URL at module init, suppliers/aliexpress.ts reads APP_KEY, etc).
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
  vi.stubEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  vi.stubEnv('OPENAI_CHAT_MODEL', 'gpt-4o');
  vi.stubEnv('ALIEXPRESS_APP_KEY', 'test-app-key');
  vi.stubEnv('ALIEXPRESS_APP_SECRET', 'test-app-secret');
  vi.stubEnv('CJ_DROPSHIPPING_EMAIL', 'test@test.local');
  vi.stubEnv('CJ_DROPSHIPPING_API_KEY', 'test-cj-key');
  vi.stubEnv('MEDUSA_URL', 'http://medusa-mock.local');
  vi.stubEnv('MEDUSA_ADMIN_API_TOKEN', 'test-medusa-token');
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost/test');
  vi.stubEnv(
    'STORE_SECRETS_KEY',
    'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
  );
  // R2 / ComfyUI explicitly *not* configured — keeps mono-mode asset gen on
  // its no-op path even if a test forgets to set mode='collection'.
  vi.stubEnv('R2_ACCOUNT_ID', '');
  vi.stubEnv('COMFY_DEPLOY_API_KEY', '');
  vi.stubEnv('COMFYUI_URL', '');
  // New supplier env vars — all empty so each client short-circuits
  // immediately (no HTTP, no DB) and returns {success:false, products:[]}.
  vi.stubEnv('SUPPLIER_ZENDROP_CLIENT_ID', '');
  vi.stubEnv('SUPPLIER_ZENDROP_CLIENT_SECRET', '');
  vi.stubEnv('SUPPLIER_ZENDROP_MCP_URL', 'https://app.zendrop.com/mcp/v1');
  vi.stubEnv('SUPPLIER_SPOCKET_API_KEY', '');
  vi.stubEnv('SUPPLIER_SYNCEE_API_KEY', '');
  vi.stubEnv('SUPPLIER_SYNCEE_FEED_URL', '');
  vi.stubEnv('BIGBUY_API_KEY', '');
  vi.stubEnv('W2B_API_KEY', '');
  vi.stubEnv('DOBA_ACCESS_KEY', '');
  vi.stubEnv('DOBA_SECRET', '');
  vi.stubEnv('INVENTORY_SOURCE_API_KEY', '');
  vi.stubEnv('AUTODS_API_URL', '');
  vi.stubEnv('AUTODS_BUYER_ACCOUNT_ID', '');

  server.listen({
    // Anything not matched by a handler should fail loudly: it means the test
    // missed a mock and would otherwise hit a real endpoint.
    onUnhandledRequest: 'error',
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});
