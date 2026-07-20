import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// persistAsset owns the R2-vs-filesystem decision; we stub it to assert the
// helper's own contract (fetch, validation, key naming, fail-soft).
const persistAsset = vi.hoisted(() => vi.fn());
vi.mock('./asset-generator', () => ({ persistAsset }));

import { persistSupplierProductImage } from './supplier-image';

const ARGS = {
  slug: 'pulse-module-test',
  provider: 'aliexpress',
  externalId: '1005011830880709',
  imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/Sabc.jpg',
};

function imageResponse(bytes: Buffer, contentType = 'image/jpeg') {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': contentType, 'content-length': String(bytes.byteLength) }),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response;
}

describe('persistSupplierProductImage', () => {
  beforeEach(() => {
    persistAsset.mockReset();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('downloads the supplier image and persists it to R2', async () => {
    const bytes = Buffer.from('fake-jpeg-bytes');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(imageResponse(bytes)));
    persistAsset.mockResolvedValue(
      'https://pub-abc.r2.dev/pulse-module-test/products/aliexpress-1005011830880709.jpg',
    );

    const r = await persistSupplierProductImage(ARGS);

    expect(r.storageProvider).toBe('r2');
    expect(r.persistedUrl).toContain('r2.dev');
    expect(r.persistedUrl).not.toContain('aliexpress-media');
    expect(r.originalUrl).toBe(ARGS.imageUrl);
    expect(r.warning).toBeUndefined();
    expect(persistAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        storeSlug: 'pulse-module-test',
        runDirName: 'products',
        filename: 'aliexpress-1005011830880709.jpg',
      }),
    );
  });

  it('reports the local backend when persistAsset falls back to the filesystem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(imageResponse(Buffer.from('x'))));
    persistAsset.mockResolvedValue('/generated/pulse-module-test/products/aliexpress-123.jpg');

    const r = await persistSupplierProductImage({ ...ARGS, externalId: '123' });

    expect(r.storageProvider).toBe('local');
    expect(r.persistedUrl).toBe('/generated/pulse-module-test/products/aliexpress-123.jpg');
    expect(r.warning).toBeUndefined();
  });

  it('keeps the original URL and warns when the download fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ETIMEDOUT')));

    const r = await persistSupplierProductImage(ARGS);

    expect(r.persistedUrl).toBe(ARGS.imageUrl);
    expect(r.storageProvider).toBe('none');
    expect(r.warning).toMatch(/ETIMEDOUT/);
    expect(persistAsset).not.toHaveBeenCalled();
  });

  it('keeps the original URL on a non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, headers: new Headers() } as unknown as Response),
    );

    const r = await persistSupplierProductImage(ARGS);

    expect(r.persistedUrl).toBe(ARGS.imageUrl);
    expect(r.warning).toMatch(/HTTP 403/);
    expect(persistAsset).not.toHaveBeenCalled();
  });

  it('refuses a non-image content-type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => new ArrayBuffer(4),
      } as unknown as Response),
    );

    const r = await persistSupplierProductImage(ARGS);

    expect(r.warning).toMatch(/content-type/);
    expect(persistAsset).not.toHaveBeenCalled();
  });

  it('refuses an oversized image without downloading it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': String(20 * 1024 * 1024) }),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response),
    );

    const r = await persistSupplierProductImage(ARGS);

    expect(r.warning).toMatch(/trop lourde/);
    expect(persistAsset).not.toHaveBeenCalled();
  });

  it('rejects an empty URL without any network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await persistSupplierProductImage({ ...ARGS, imageUrl: '' });

    expect(r.warning).toMatch(/vide/);
    expect(r.storageProvider).toBe('none');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats an already-persisted local URL as a no-op', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await persistSupplierProductImage({
      ...ARGS,
      imageUrl: '/generated/pulse-module-test/products/aliexpress-1.jpg',
    });

    expect(r.storageProvider).toBe('local');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('derives the extension from the content-type, not the URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(imageResponse(Buffer.from('x'), 'image/webp')));
    persistAsset.mockResolvedValue('https://pub-abc.r2.dev/k.webp');

    await persistSupplierProductImage({ ...ARGS, imageUrl: 'https://cdn.test/photo' });

    expect(persistAsset).toHaveBeenCalledWith(
      expect.objectContaining({ filename: expect.stringMatching(/\.webp$/) }),
    );
  });
});
