import { http, HttpResponse } from 'msw';

/**
 * Zendrop MCP mock handler.
 *
 * Default: 401 auth error — mirrors the "no token stored" state.
 * The zendrop client short-circuits when getAccessToken() returns null (no DB
 * token), so this handler is a defensive fallback for any case where a token
 * somehow ends up in the test environment.
 */

const MCP_URL = 'https://app.zendrop.com/mcp/v1';

export const zendropHandlers = [
  http.post(MCP_URL, () => {
    return HttpResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing Bearer token.' },
      { status: 401 },
    );
  }),
  // OAuth token endpoint — also fail-closed.
  http.post('https://app.zendrop.com/oauth/token', () => {
    return HttpResponse.json(
      { error: 'invalid_client', error_description: 'Client credentials invalid.' },
      { status: 401 },
    );
  }),
];
