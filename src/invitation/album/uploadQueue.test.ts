import { describe, expect, it, vi } from 'vitest';
import { ApiError, type AlbumPhotoUpload, type PublicApi } from '@/shared/api';
import { AlbumUploadQueue, CONCURRENCY, RETRIES } from './uploadQueue';

const prepared: AlbumPhotoUpload = {
  photo: new Blob(['p']),
  thumb: new Blob(['t']),
  ext: 'webp',
  width: 10,
  height: 10,
};

function file(name: string) {
  return new File(['x'], name, { type: 'image/jpeg' });
}

/** Resolves once every queued promise and microtask has run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(
  upload: PublicApi['uploadAlbumPhoto'],
  prepare: (file: File) => Promise<AlbumPhotoUpload> = vi.fn(async () => prepared),
) {
  const api = { uploadAlbumPhoto: vi.fn(upload) } as unknown as PublicApi & {
    uploadAlbumPhoto: ReturnType<typeof vi.fn>;
  };
  const sleep = vi.fn(async () => {});
  const queue = new AlbumUploadQueue(api, 'abc234', prepare, sleep);
  return { api, queue, prepare, sleep };
}

describe('AlbumUploadQueue', () => {
  it(`uploads at most ${CONCURRENCY} photos at a time, all of them in the end`, async () => {
    let active = 0;
    let peak = 0;
    const { queue, api } = setup(async (_code, _upload, options) => {
      active++;
      peak = Math.max(peak, active);
      options?.onProgress?.(0.5);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    });
    queue.add(Array.from({ length: 8 }, (_, i) => file(`foto-${i}.jpg`)));
    expect(queue.busy).toBe(true);
    await vi.waitFor(() =>
      expect(queue.getSnapshot().every((i) => i.status === 'done')).toBe(true),
    );
    expect(peak).toBe(CONCURRENCY);
    expect(api.uploadAlbumPhoto).toHaveBeenCalledTimes(8);
    expect(api.uploadAlbumPhoto.mock.calls[0]![0]).toBe('abc234');
    expect(queue.busy).toBe(false);
  });

  it('retries a failed upload automatically, then succeeds', async () => {
    let calls = 0;
    const { queue, sleep } = setup(async () => {
      if (++calls < 3) throw new ApiError('network');
    });
    queue.add([file('a.jpg')]);
    await vi.waitFor(() => expect(queue.getSnapshot()[0]!.status).toBe('done'));
    expect(calls).toBe(3);
    expect(sleep.mock.calls).toEqual([[1000], [3000]]);
  });

  it('after the automatic retries it waits for the guest, reusing the compressed photo', async () => {
    let fail = true;
    const { queue, prepare, api } = setup(async () => {
      if (fail) throw new ApiError('network');
    });
    queue.add([file('a.jpg')]);
    await vi.waitFor(() => expect(queue.getSnapshot()[0]!.status).toBe('error'));
    expect(api.uploadAlbumPhoto).toHaveBeenCalledTimes(RETRIES + 1);
    expect(queue.getSnapshot()[0]!.error).toMatch(/Revisa tu conexión/);

    fail = false;
    queue.retry('0');
    await vi.waitFor(() => expect(queue.getSnapshot()[0]!.status).toBe('done'));
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the album refuses (closed or full)', async () => {
    const { queue, api } = setup(async () => {
      throw new ApiError('album_closed');
    });
    queue.add([file('a.jpg')]);
    await vi.waitFor(() => expect(queue.getSnapshot()[0]!.status).toBe('error'));
    expect(api.uploadAlbumPhoto).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()[0]!.error).toBe('El álbum ya no recibe fotos.');
  });

  it('reports a photo it cannot read and goes on with the rest', async () => {
    const prepare = vi.fn(async (f: File) => {
      if (f.name.endsWith('.heic')) throw new Error('unsupported');
      return prepared;
    });
    const { queue } = setup(async () => {}, prepare);
    queue.add([file('a.heic'), file('b.jpg')]);
    await vi.waitFor(() => expect(queue.busy).toBe(false));
    expect(queue.getSnapshot().map((i) => [i.name, i.status])).toEqual([
      ['a.heic', 'error'],
      ['b.jpg', 'done'],
    ]);
    expect(queue.getSnapshot()[0]!.error).toMatch(/No pudimos leer/);
    expect(queue.getSnapshot()[0]!.retryable).toBe(false);
    // Retrying an unreadable photo would fail the same way: nothing happens.
    queue.retry('0');
    await flush();
    expect(queue.getSnapshot()[0]!.status).toBe('error');
  });

  it('notifies subscribers with a new snapshot on every change', async () => {
    const { queue } = setup(async () => {});
    const snapshots: unknown[] = [];
    queue.subscribe(() => snapshots.push(queue.getSnapshot()));
    queue.add([file('a.jpg')]);
    await vi.waitFor(() => expect(queue.busy).toBe(false));
    expect(new Set(snapshots).size).toBe(snapshots.length);
    expect(snapshots.length).toBeGreaterThan(2);
  });
});
