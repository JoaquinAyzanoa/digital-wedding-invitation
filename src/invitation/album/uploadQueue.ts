import { ApiError, type AlbumPhotoUpload, type PublicApi } from '@/shared/api';

export type UploadStatus = 'waiting' | 'preparing' | 'uploading' | 'done' | 'error';

export interface UploadItem {
  id: string;
  name: string;
  status: UploadStatus;
  /** 0–1 while uploading. */
  progress: number;
  error?: string;
  /** The guest can try again (not for a file that cannot be read). */
  retryable?: boolean;
}

export const CONCURRENCY = 3;
/** Automatic retries after the first try (network hiccups on a phone). */
export const RETRIES = 2;

const MESSAGES = {
  unreadable: 'No pudimos leer esta foto (¿formato no compatible?).',
  closed: 'El álbum ya no recibe fotos.',
  failed: 'No se pudo subir. Revisa tu conexión y reintenta.',
};

type Prepare = (file: File) => Promise<AlbumPhotoUpload>;
type Sleep = (ms: number) => Promise<void>;

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Photos waiting to go to the album: compressed and uploaded a few at a time, each with its
 * progress, retried automatically and, if it still fails, by hand. Plain class (not React
 * state) so the queue logic is easy to follow and to test; components subscribe to it.
 */
export class AlbumUploadQueue {
  private items: UploadItem[] = [];
  private listeners = new Set<() => void>();
  private files = new Map<string, File>();
  private prepared = new Map<string, AlbumPhotoUpload>();
  private waiting: string[] = [];
  private running = 0;
  private controller = new AbortController();
  private nextId = 0;

  constructor(
    private api: PublicApi,
    private code: string,
    private prepare: Prepare,
    private sleep: Sleep = defaultSleep,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.items;

  /** True while photos are waiting or going up (to warn before leaving the page). */
  get busy() {
    return this.items.some((i) => i.status !== 'done' && i.status !== 'error');
  }

  add(files: File[]) {
    const added = files.map((file) => {
      const id = String(this.nextId++);
      this.files.set(id, file);
      this.waiting.push(id);
      return { id, name: file.name, status: 'waiting' as const, progress: 0 };
    });
    this.set([...this.items, ...added]);
    this.pump();
  }

  retry(id: string) {
    const item = this.items.find((i) => i.id === id);
    if (item?.status !== 'error' || !this.files.has(id)) return;
    this.update(id, { status: 'waiting', progress: 0, error: undefined });
    this.waiting.push(id);
    this.pump();
  }

  retryAll() {
    for (const item of this.items) if (item.status === 'error') this.retry(item.id);
  }

  /** Stops what is going up (the page is closing). */
  abort() {
    this.controller.abort();
    this.controller = new AbortController();
  }

  private set(items: UploadItem[]) {
    this.items = items;
    for (const listener of this.listeners) listener();
  }

  private update(id: string, patch: Partial<UploadItem>) {
    this.set(this.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  private pump() {
    while (this.running < CONCURRENCY && this.waiting.length) {
      const id = this.waiting.shift()!;
      this.running++;
      void this.process(id).finally(() => {
        this.running--;
        this.pump();
      });
    }
  }

  private async process(id: string) {
    const file = this.files.get(id)!;
    const signal = this.controller.signal;

    let upload = this.prepared.get(id);
    if (!upload) {
      this.update(id, { status: 'preparing' });
      try {
        upload = await this.prepare(file);
        this.prepared.set(id, upload);
      } catch {
        this.files.delete(id); // retrying would fail the same way
        this.update(id, { status: 'error', error: MESSAGES.unreadable, retryable: false });
        return;
      }
    }

    for (let attempt = 0; ; attempt++) {
      this.update(id, { status: 'uploading', progress: 0 });
      try {
        await this.api.uploadAlbumPhoto(this.code, upload, {
          signal,
          onProgress: (progress) => this.update(id, { progress }),
        });
        // Done: free the memory (a phone may send dozens of photos).
        this.files.delete(id);
        this.prepared.delete(id);
        this.update(id, { status: 'done', progress: 1 });
        return;
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ApiError && error.code === 'album_closed') {
          this.update(id, { status: 'error', error: MESSAGES.closed, retryable: true });
          return;
        }
        if (attempt >= RETRIES) {
          this.update(id, { status: 'error', error: MESSAGES.failed, retryable: true });
          return;
        }
        await this.sleep(1000 * 3 ** attempt);
      }
    }
  }
}
