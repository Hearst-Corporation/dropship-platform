import { http, HttpResponse } from 'msw';

/**
 * Supplier product-image CDNs.
 *
 * `persistSupplierProductImage` (lib/agent/supplier-image.ts) downloads the
 * supplier hotlink server-side so the storefront never depends on a CDN we
 * don't own. That download is a real `fetch` during the store-creator E2E
 * run, so MSW needs handlers for the image hosts the fixtures point at —
 * otherwise every pipeline test logs an unhandled-request error.
 *
 * A 1x1 PNG is enough: the helper only checks status, content-type and size.
 */
const ONE_PX_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const imageResponse = () =>
  HttpResponse.arrayBuffer(ONE_PX_PNG.buffer.slice(0) as ArrayBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(ONE_PX_PNG.byteLength),
    },
  });

export const supplierImageHandlers = [
  http.get('https://picsum.photos/*', imageResponse),
  http.get('https://ae-pic-a1.aliexpress-media.com/*', imageResponse),
  http.get('https://ae01.alicdn.com/*', imageResponse),
  http.get('https://cf.cjdropshipping.com/*', imageResponse),
  http.get('https://oss-cf.cjdropshipping.com/*', imageResponse),
];
