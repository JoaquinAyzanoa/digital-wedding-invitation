import { describe, expect, it, vi } from 'vitest';
import { ApiError, type PublicApi } from '@/shared/api';
import { AlbumUploadQueue, CONCURRENCY, MAX_PHOTO_BYTES, RETRIES } from './uploadQueue';

const URL = 'https://script.google.com/macros/s/x/exec';

function file(name: string, { type = 'image/jpeg', size = 10 } = {}) {
  const f = new File(['x'.repeat(Math.min(size, 10))], name, { type });
  if (size > 10) Object.defineProperty(f, 'size', { value: size });
  return f;
}

function setup(upload: PublicApi['uploadAlbumPhoto']) {
  const api = { uploadAlbumPhoto: vi.fn(upload) } as unknown as PublicApi & {
    uploadAlbumPhoto: ReturnType<typeof vi.fn>;
  };
  const sleep = vi.fn(async () => {});
  const queue = new AlbumUploadQueue(api, URL, 'abc234', sleep);
  return { api, queue, sleep };
}

const done = (queue: AlbumUploadQueue) => vi.waitFor(() => expect(queue.busy).toBe(false));

describe('AlbumUploadQueue', () => {
  it(`sends the original files, at most ${CONCURRENCY} at a time`, async () => {
    let active = 0;
    let peak = 0;
    const { queue, api } = setup(async (_url, _code, _file, options) => {
      active++;
      peak = Math.max(peak, active);
      options?.onProgress?.(0.5);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    });
    const files = Array.from({ length: 6 }, (_, i) => file(`IMG_${i}.JPG`));
    queue.add(files);
    expect(queue.busy).toBe(true);
    await done(queue);
    expect(queue.getSnapshot().every((i) => i.status === 'done')).toBe(true);
    expect(peak).toBe(CONCURRENCY);
    // The very same File objects: nothing is recompressed.
    expect(api.uploadAlbumPhoto.mock.calls.map((c) => c[2])).toEqual(files);
    expect(api.uploadAlbumPhoto.mock.calls[0]!.slice(0, 2)).toEqual([URL, 'abc234']);
  });

  it('retries a failed upload automatically, then succeeds', async () => {
    let calls = 0;
    const { queue, sleep } = setup(async () => {
      if (++calls < 3) throw new ApiError('network');
    });
    queue.add([file('a.jpg')]);
    await done(queue);
    expect(queue.getSnapshot()[0]!.status).toBe('done');
    expect(sleep.mock.calls).toEqual([[1000], [3000]]);
  });

  it('after the automatic retries it waits for the guest', async () => {
    let fail = true;
    const { queue, api } = setup(async () => {
      if (fail) throw new ApiError('network');
    });
    queue.add([file('a.jpg')]);
    await done(queue);
    expect(api.uploadAlbumPhoto).toHaveBeenCalledTimes(RETRIES + 1);
    expect(queue.getSnapshot()[0]).toMatchObject({ status: 'error', retryable: true });

    fail = false;
    queue.retry('0');
    await done(queue);
    expect(queue.getSnapshot()[0]!.status).toBe('done');
  });

  it.each([
    ['album_closed', 'El álbum ya no recibe fotos.'],
    ['album_full', 'Llegaste al máximo de fotos para tu invitación. ¡Gracias!'],
    ['too_large', 'Pesa más de 25 MB.'],
  ] as const)('does not retry when the album answers %s', async (code, message) => {
    const { queue, api } = setup(async () => {
      throw new ApiError(code);
    });
    queue.add([file('a.jpg')]);
    await done(queue);
    expect(api.uploadAlbumPhoto).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()[0]).toMatchObject({ error: message, retryable: false });
  });

  it('turns away files that are not photos or are too big, before sending anything', async () => {
    const { queue, api } = setup(async () => {});
    queue.add([
      file('nota.txt', { type: 'text/plain' }),
      file('video.jpg', { size: MAX_PHOTO_BYTES + 1 }),
      file('IMG_1.HEIC', { type: '' }), // type guessed from the name
    ]);
    await done(queue);
    expect(queue.getSnapshot().map((i) => [i.name, i.status, i.error])).toEqual([
      ['nota.txt', 'error', 'Este archivo no es una foto.'],
      ['video.jpg', 'error', 'Pesa más de 25 MB.'],
      ['IMG_1.HEIC', 'done', undefined],
    ]);
    expect(api.uploadAlbumPhoto).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers with a new snapshot on every change', async () => {
    const { queue } = setup(async () => {});
    const snapshots: unknown[] = [];
    queue.subscribe(() => snapshots.push(queue.getSnapshot()));
    queue.add([file('a.jpg')]);
    await done(queue);
    expect(new Set(snapshots).size).toBe(snapshots.length);
    expect(snapshots.length).toBeGreaterThan(2);
  });
});
