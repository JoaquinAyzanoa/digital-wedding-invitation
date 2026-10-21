import { describe, expect, it, vi } from 'vitest';
import { ApiError, type PublicApi } from '@/shared/api';
import {
  AlbumUploadQueue,
  CONCURRENCY,
  MAX_BYTES,
  RETRIES,
  shownProgress,
  type UploadItem,
} from './uploadQueue';

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
  const queue = new AlbumUploadQueue(api, URL, sleep);
  return { api, queue, sleep };
}

const done = (queue: AlbumUploadQueue) => vi.waitFor(() => expect(queue.busy).toBe(false));

describe('AlbumUploadQueue', () => {
  it(`sends the original files, at most ${CONCURRENCY} at a time`, async () => {
    let active = 0;
    let peak = 0;
    const { queue, api } = setup(async (_url, _file, options) => {
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
    expect(api.uploadAlbumPhoto.mock.calls.map((c) => c[1])).toEqual(files);
    expect(api.uploadAlbumPhoto.mock.calls[0]![0]).toBe(URL);
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
    ['too_large', 'Pesa demasiado para el álbum.'],
  ] as const)('does not retry when the album answers %s', async (code, message) => {
    const { queue, api } = setup(async () => {
      throw new ApiError(code);
    });
    queue.add([file('a.jpg')]);
    await done(queue);
    expect(api.uploadAlbumPhoto).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()[0]).toMatchObject({ error: message, retryable: false });
  });

  it('turns away files that are not photos or videos, or are too big, before sending', async () => {
    const { queue, api } = setup(async () => {});
    queue.add([
      file('nota.txt', { type: 'text/plain' }),
      file('enorme.jpg', { size: MAX_BYTES.photo + 1 }),
      file('pelicula.mp4', { type: 'video/mp4', size: MAX_BYTES.video + 1 }),
      file('IMG_1.HEIC', { type: '' }), // type guessed from the name
      file('VID_1.MOV', { type: '', size: 300 * 1024 * 1024 }), // a video, within its limit
    ]);
    await done(queue);
    expect(queue.getSnapshot().map((i) => [i.name, i.kind, i.status, i.error])).toEqual([
      ['nota.txt', 'photo', 'error', 'Este archivo no es una foto ni un video.'],
      ['enorme.jpg', 'photo', 'error', 'La foto pesa más de 50 MB.'],
      ['pelicula.mp4', 'video', 'error', 'El video pesa más de 1 GB.'],
      ['IMG_1.HEIC', 'photo', 'done', undefined],
      ['VID_1.MOV', 'video', 'done', undefined],
    ]);
    expect(api.uploadAlbumPhoto).toHaveBeenCalledTimes(2);
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

describe('the bar while a photo goes up', () => {
  const uploading: UploadItem = {
    id: '0',
    name: 'a.jpg',
    kind: 'photo',
    status: 'uploading',
    progress: 0,
    startedAt: 1000,
    expectedMs: 10_000,
  };

  it('advances from the estimate, slowing down, and never reaches the end by itself', () => {
    const at = (ms: number) => shownProgress(uploading, 1000 + ms);
    expect(at(0)).toBe(0);
    expect(at(2_500)).toBeGreaterThan(0.3);
    expect(at(10_000)).toBeGreaterThan(0.8);
    expect(at(10_000)).toBeLessThan(0.9);
    expect(at(60_000)).toBeLessThanOrEqual(0.95);
    expect(at(5_000)).toBeGreaterThan(at(2_500));
  });

  it('switches to the real progress as soon as the upload reports it', () => {
    expect(shownProgress({ ...uploading, progress: 0.99 }, 1001)).toBe(0.99);
    // Real progress wins even when the estimate would show more.
    expect(shownProgress({ ...uploading, progress: 0.1 }, 1000 + 60_000)).toBe(0.1);
    expect(shownProgress({ ...uploading, status: 'done' }, 0)).toBe(1);
    expect(shownProgress({ ...uploading, status: 'waiting' }, 99_999)).toBe(0);
  });

  it('learns the real speed from the photos that finish', async () => {
    const { queue } = setup(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const before = queue.expectedMs(4 * 1024 * 1024);
    queue.add([file('a.jpg', { size: 4 * 1024 * 1024 })]);
    expect(queue.getSnapshot()[0]!.expectedMs).toBeCloseTo(before);
    await done(queue);
    // It finished far faster than the 4 s overhead: no learning from an impossible time.
    expect(queue.expectedMs(4 * 1024 * 1024)).toBe(before);
  });
});
