import { http, HttpResponse } from 'msw';

/**
 * Doba open API mock handlers.
 *
 * Default: error response on all Doba endpoints.
 * The doba client short-circuits when DOBA_ACCESS_KEY is empty,
 * so these handlers are defensive fallbacks.
 */

export const dobaHandlers = [
  http.post('https://open.doba.com/api/product/search', () => {
    return HttpResponse.json(
      { code: 401, message: 'Access key missing or invalid.' },
      { status: 401 },
    );
  }),
];
