import { http, HttpResponse } from 'msw';

/**
 * BigBuy API mock handlers.
 *
 * Default: 401 auth error on all BigBuy API endpoints.
 * The bigbuy client short-circuits when BIGBUY_API_KEY is empty,
 * so these handlers are defensive fallbacks.
 */

export const bigbuyHandlers = [
  http.get('https://api.bigbuy.eu/rest/catalog/products.json', () => {
    return HttpResponse.json(
      [{ message: 'Unauthorized', code: 401 }],
      { status: 401 },
    );
  }),
  http.get('https://api.bigbuy.eu/rest/catalog/productimages/:id.json', () => {
    return HttpResponse.json(
      [{ message: 'Unauthorized', code: 401 }],
      { status: 401 },
    );
  }),
  http.get('https://api.bigbuy.eu/rest/order/carriers/new.json', () => {
    return HttpResponse.json(
      [{ message: 'Unauthorized', code: 401 }],
      { status: 401 },
    );
  }),
  http.post('https://api.bigbuy.eu/rest/order/check.json', () => {
    return HttpResponse.json(
      [{ message: 'Unauthorized', code: 401 }],
      { status: 401 },
    );
  }),
  http.post('https://api.bigbuy.eu/rest/order/create.json', () => {
    return HttpResponse.json(
      [{ message: 'Unauthorized', code: 401 }],
      { status: 401 },
    );
  }),
];
