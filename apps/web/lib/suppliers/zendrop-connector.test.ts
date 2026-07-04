import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toZendropProduct, zendropClient, zendropConnector } from './zendrop-connector';

function mcpOk(structuredContent: unknown) {
  return {
    ok: true,
    json: async () => ({ jsonrpc: '2.0', id: 1, result: { structuredContent, isError: false } }),
    text: async () => '',
  };
}

describe('toZendropProduct', () => {
  it('maps a raw Zendrop catalog product to the internal format', () => {
    const raw = {
      id: 2919696,
      name: 'S925 Silver Stud Earrings',
      description: '<p>desc</p>',
      image: 'https://file.zendrop.com/a.jpg',
      images: [{ id: 1, url: 'https://file.zendrop.com/a.jpg' }, { id: 2, url: 'https://file.zendrop.com/b.jpg' }],
      price: '12.78',
    };
    expect(toZendropProduct(raw)).toEqual({
      supplier: 'Zendrop',
      supplierProductId: '2919696',
      title: 'S925 Silver Stud Earrings',
      description: '<p>desc</p>',
      images: ['https://file.zendrop.com/a.jpg', 'https://file.zendrop.com/b.jpg'],
      variants: undefined,
      costPrice: 12.78,
      currency: 'USD',
      stockStatus: 'unknown',
      raw,
    });
  });

  it('falls back to the single image when images[] is absent', () => {
    const p = toZendropProduct({ id: 7, name: 'X', image: 'https://z/x.jpg', price: 5 });
    expect(p.images).toEqual(['https://z/x.jpg']);
    expect(p.costPrice).toBe(5);
  });

  it('leaves costPrice undefined on an unparseable price', () => {
    expect(toZendropProduct({ id: 1, name: 'Y', price: 'n/a' }).costPrice).toBeUndefined();
  });
});

describe('zendropConnector', () => {
  beforeEach(() => {
    vi.stubEnv('ZENDROP_API_TOKEN', 'test-zendrop-token');
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isConfigured reflects the env token', () => {
    expect(zendropConnector.isConfigured()).toBe(true);
    vi.stubEnv('ZENDROP_API_TOKEN', '');
    expect(zendropConnector.isConfigured()).toBe(false);
  });

  it('testConnection returns ok + store count from get_stores', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mcpOk({ total: 3, page: 1, limit: 1, stores: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await zendropConnector.testConnection();
    expect(r.ok).toBe(true);
    expect(r.storeCount).toBe(3);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.method).toBe('tools/call');
    expect(body.params.name).toBe('get_stores');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-zendrop-token');
  });

  it('testConnection returns not-ok when the token is missing (no network call)', async () => {
    vi.stubEnv('ZENDROP_API_TOKEN', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await zendropConnector.testConnection();
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getCatalogProducts maps results and forwards query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mcpOk({
        total: 1,
        products: [{ id: 42, name: 'Ring', image: 'https://z/r.jpg', images: [{ id: 9, url: 'https://z/r.jpg' }], price: '9.99' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { total, products } = await zendropConnector.getCatalogProducts({ keyword: 'ring', limit: 5 });
    expect(total).toBe(1);
    expect(products[0].supplierProductId).toBe('42');
    expect(products[0].costPrice).toBe(9.99);
    const args = JSON.parse(fetchMock.mock.calls[0][1].body).params.arguments;
    expect(args).toEqual({ keyword: 'ring', limit: 5 });
  });

  it('throws a masked-token error on HTTP failure (never leaks the full token)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(zendropConnector.listStores()).rejects.toThrow(/HTTP 401/);
    await expect(zendropConnector.listStores()).rejects.not.toThrow(/test-zendrop-token/);
  });
});

// This is the SupplierClient actually wired into lib/suppliers/registry.ts —
// zendrop.ts also exports a same-named client but it requires the
// unconfigured OAuth flow, so registry.ts imports this one instead.
describe('zendropClient (registry adapter)', () => {
  beforeEach(() => {
    vi.stubEnv('ZENDROP_API_TOKEN', 'test-zendrop-token');
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is search_only — catalog search works, fulfillment is not wired yet', () => {
    expect(zendropClient.id).toBe('zendrop');
    expect(zendropClient.status).toBe('search_only');
    expect(zendropClient.placeOrder).toBeUndefined();
  });

  it('ensureAuth reflects whether the token is configured', async () => {
    expect(await zendropClient.ensureAuth!()).toBe(true);
    vi.stubEnv('ZENDROP_API_TOKEN', '');
    expect(await zendropClient.ensureAuth!()).toBe(false);
  });

  it('searchProducts returns needsAuth when the token is missing (no network call)', async () => {
    vi.stubEnv('ZENDROP_API_TOKEN', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await zendropClient.searchProducts({ keywords: 'anything' });
    expect(result).toEqual({ success: false, products: [], needsAuth: true, error: expect.any(String) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searchProducts maps catalog results into RawProduct (EUR price, supplier id)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mcpOk({
        total: 1,
        products: [{ id: 42, name: 'Ring', image: 'https://z/r.jpg', images: [{ id: 9, url: 'https://z/r.jpg' }], price: '10' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await zendropClient.searchProducts({ keywords: 'ring', page: 2, pageSize: 5 });
    expect(result.success).toBe(true);
    expect(result.total).toBe(1);
    expect(result.products).toEqual([
      {
        supplier: 'zendrop',
        externalId: '42',
        title: 'Ring',
        price: expect.any(Number),
        imageUrl: 'https://z/r.jpg',
        supplierUrl: 'https://app.zendrop.com/product/42',
      },
    ]);
    const args = JSON.parse(fetchMock.mock.calls[0][1].body).params.arguments;
    expect(args).toEqual({ keyword: 'ring', page: 2, limit: 5 });
  });

  it('searchProducts fails soft on a connector error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    vi.stubGlobal('fetch', fetchMock);
    const result = await zendropClient.searchProducts({ keywords: 'anything' });
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
    expect(result.error).toMatch(/HTTP 500/);
  });
});
