import { ApiError, type ApiErrorCode, type PublicApi } from '@/shared/api';
import { photoType } from '@/shared/api/driveUpload';

export type UploadStatus = 'waiting' | 'uploading' | 'done' | 'error';

export interface UploadItem {
  id: string;
  name: string;
  status: UploadStatus;
  /** 0–1 while uploading, when the upload reports it (the Drive one cannot: see driveUpload). */
  progress: number;
  /** When it started going up, and how long it should take (to show an estimated bar). */
  startedAt?: number;
  expectedMs?: number;
  error?: string;
  /** The guest can try again (not for a file that is not a photo or is too big). */
  retryable?: boolean;
}

/** Original photos go up as they are; the web app accepts up to 25 MB. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const CONCURRENCY = 3;
/** Automatic retries after the first try (network hiccups on a phone). */
export const RETRIES = 2;

const MESSAGES = {
  notPhoto: 'Este archivo no es una foto.',
  tooLarge: 'Pesa más de 25 MB.',
  closed: 'El álbum ya no recibe fotos.',
  failed: 'No se pudo subir. Revisa tu conexión y reintenta.',
};

/** Answers that will not change by trying again. */
const FINAL: Partial<Record<ApiErrorCode, string>> = {
  album_closed: MESSAGES.closed,
  too_large: MESSAGES.tooLarge,
  invalid_payload: MESSAGES.notPhoto,
};

/**
 * The bar while a photo goes up: the real progress when the upload reports it, otherwise an
 * estimate from the photo's size that slows down near the end and never claims it is done
 * (0.95 at most) until the answer arrives.
 */
export function shownProgress(item: UploadItem, now: number): number {
  if (item.status === 'done') return 1;
  if (item.status !== 'uploading') return 0;
  if (!item.startedAt || !item.expectedMs) return item.progress;
  const estimate = 0.95 * (1 - Math.exp((-2.3 * (now - item.startedAt)) / item.expectedMs));
  return Math.max(item.progress, estimate);
}

type Sleep = (ms: number) => Promise<void>;

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Photos waiting to go to the album: uploaded as they are (original quality), a couple at a
 * time, each with its progress, retried automatically and, if it still fails, by hand. Plain
 * class (not React state) so the queue logic is easy to follow and to test.
 */
export class AlbumUploadQueue {
  private items: UploadItem[] = [];
  private listeners = new Set<() => void>();
  private files = new Map<string, File>();
  private waiting: string[] = [];
  private running = 0;
  private controller = new AbortController();
  private nextId = 0;
  // Measured against the real Apps Script web app: about 4 s to answer at all, then about
  // 5 s per MB (it is far slower than the guest's connection). Recalibrated as photos finish.
  private overheadMs = 4000;
  private msPerByte = 0.005;

  constructor(
    private api: PublicApi,
    private uploadUrl: string,
    private sleep: Sleep = defaultSleep,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.items;

  /** True while photos are waiting or going up (to warn before leaving the page). */
  get busy() {
    return this.items.some((i) => i.status === 'waiting' || i.status === 'uploading');
  }

  add(files: File[]) {
    const added = files.map((file): UploadItem => {
      const id = String(this.nextId++);
      const problem = !photoType(file).startsWith('image/')
        ? MESSAGES.notPhoto
        : file.size > MAX_PHOTO_BYTES
          ? MESSAGES.tooLarge
          : null;
      if (problem) return { id, name: file.name, status: 'error', progress: 0, error: problem };
      this.files.set(id, file);
      this.waiting.push(id);
      return { id, name: file.name, status: 'waiting', progress: 0 };
    });
    this.set([...this.items, ...added]);
    this.pump();
  }

  retry(id: string) {
    const item = this.items.find((i) => i.id === id);
    if (item?.status !== 'error' || !item.retryable || !this.files.has(id)) return;
    this.update(id, { status: 'waiting', progress: 0, error: undefined, retryable: undefined });
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

  /** Learns the real speed from each finished photo (halfway between old and new). */
  private calibrate(bytes: number, ms: number) {
    if (bytes <= 0 || ms <= this.overheadMs) return;
    const observed = (ms - this.overheadMs) / bytes;
    this.msPerByte = Math.max(0.0002, (this.msPerByte + observed) / 2);
  }

  /** How long a photo of this size should take now (for tests and the bar). */
  expectedMs(bytes: number) {
    return this.overheadMs + bytes * this.msPerByte;
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

    for (let attempt = 0; ; attempt++) {
      const startedAt = Date.now();
      this.update(id, {
        status: 'uploading',
        progress: 0,
        startedAt,
        expectedMs: this.overheadMs + file.size * this.msPerByte,
      });
      try {
        await this.api.uploadAlbumPhoto(this.uploadUrl, file, {
          signal,
          onProgress: (progress) => this.update(id, { progress }),
        });
        this.calibrate(file.size, Date.now() - startedAt);
        this.files.delete(id); // free the memory (a phone may send dozens of photos)
        this.update(id, { status: 'done', progress: 1 });
        return;
      } catch (error) {
        if (signal.aborted) return;
        const final = error instanceof ApiError ? FINAL[error.code] : undefined;
        if (final) {
          this.files.delete(id);
          this.update(id, { status: 'error', error: final, retryable: false });
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
