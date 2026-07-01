import { http, HttpResponse } from 'msw';

/**
 * Spocket catalog API mock handler.
 *
 * Default: 401 auth error — mirrors the "no API key" state.
 * The spocket client short-circuits when SUPPLIER_SPOCKET_API_KEY is empty,
 * so this handler is a defensive fallback.
 */

export const spocketHandlers = [
  http.get('https://app.spocket.co/api/v1/products/search', () => {
    return HttpResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing API key.' },
      { status: 401 },
    );
  }),
];
