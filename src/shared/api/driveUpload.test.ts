// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadToDrive } from './driveUpload';
import { ApiError } from './types';

const URL = 'https://script.google.com/macros/s/x/exec';
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function reply(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

afterEach(() => vi.unstubAllGlobals());

describe('uploadToDrive', () => {
  it('sends the original file as a CORS "simple" request (Apps Script answers no preflight)', async () => {
    const fetch = reply({ ok: true });
    vi.stubGlobal('fetch', fetch);
    await uploadToDrive(URL, new File([bytes], 'IMG_1.JPG', { type: 'image/jpeg' }));

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL);
    expect(init.method).toBe('POST');
    // Only a simple content type: any other header (or an upload listener) means a preflight.
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' });
    const body = JSON.parse(init.body as string) as Record<string, string>;
    expect(body.name).toBe('IMG_1.JPG');
    expect(body.type).toBe('image/jpeg');
    expect(Buffer.from(body.data!, 'base64').equals(Buffer.from(bytes))).toBe(true);
  });

  it('passes on the reason the script refuses a photo', async () => {
    vi.stubGlobal('fetch', reply({ ok: false, error: 'too_large' }));
    await expect(
      uploadToDrive(URL, new File([bytes], 'a.jpg', { type: 'image/jpeg' })),
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  it('a failed request is a network error (retried by the queue)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const error = await uploadToDrive(
      URL,
      new File([bytes], 'a.jpg', { type: 'image/jpeg' }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('network');
  });
});
