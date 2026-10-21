// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mediaType, uploadToDrive } from './driveUpload';
import { ApiError } from './types';

const SCRIPT = 'https://script.google.com/macros/s/x/exec';
const SESSION = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=abc';

/** jsdom's Blob has no arrayBuffer(): read it the old way. */
function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
}

function file(name: string, size: number, type = 'image/jpeg') {
  const bytes = new Uint8Array(size).map((_, i) => i % 251);
  return new File([bytes], name, { type });
}

/** Stands in for Drive's resumable session: keeps what arrives, can drop one connection. */
class FakeDrive {
  received = new Uint8Array(0);
  puts: string[] = [];
  /** Which part (1, 2…) loses its connection; 0 = none. */
  dropPart = 0;
  private parts = 0;
  constructor(readonly total: number) {}
  install() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const drive = this;
    class FakeXhr {
      status = 0;
      upload: { onprogress?: (event: { loaded: number }) => void } = {};
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      private range = '';
      private headers: Record<string, string> = {};
      open(method: string, url: string) {
        expect([method, url]).toEqual(['PUT', SESSION]);
      }
      setRequestHeader(name: string, value: string) {
        if (name === 'Content-Range') this.range = value;
      }
      getResponseHeader(name: string) {
        return this.headers[name] ?? null;
      }
      abort() {}
      async send(body: Blob | null) {
        drive.puts.push(this.range);
        if (body && ++drive.parts === drive.dropPart) {
          setTimeout(() => this.onerror?.());
          return;
        }
        if (body) {
          const [, start] = /bytes (\d+)-/.exec(this.range)!;
          expect(Number(start)).toBe(drive.received.length);
          const chunk = await bytesOf(body);
          this.upload.onprogress?.({ loaded: chunk.length });
          const next = new Uint8Array(drive.received.length + chunk.length);
          next.set(drive.received);
          next.set(chunk, drive.received.length);
          drive.received = next;
        }
        const complete = drive.received.length === drive.total;
        this.status = complete ? 200 : 308;
        if (!complete && drive.received.length) {
          this.headers.Range = `bytes=0-${drive.received.length - 1}`;
        }
        setTimeout(() => this.onload?.());
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  }
}

/** The Apps Script web app's answers: a session (new script) or its connection test (old). */
function script(reply: unknown, postReply: unknown = { ok: true }) {
  const fetch = vi.fn(
    async (_url: string, init?: RequestInit) =>
      new Response(JSON.stringify(init?.method === 'POST' ? postReply : reply)),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('uploadToDrive, straight to Drive', () => {
  it('asks the script for a session, then sends the file to Drive in parts', async () => {
    const fetch = script({ ok: true, session: SESSION });
    const video = file('VID_1.MOV', 2500, 'video/quicktime');
    const drive = new FakeDrive(video.size);
    drive.install();
    const progress: number[] = [];

    await uploadToDrive(SCRIPT, video, { onProgress: (f) => progress.push(f) }, 1000);

    const asked = new URL(fetch.mock.calls[0]![0] as string);
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      action: 'session',
      name: 'VID_1.MOV',
      type: 'video/quicktime',
      size: '2500',
      origin: window.location.origin,
    });
    expect(drive.puts).toEqual([
      'bytes 0-999/2500',
      'bytes 1000-1999/2500',
      'bytes 2000-2499/2500',
    ]);
    expect(Buffer.from(drive.received).equals(Buffer.from(await bytesOf(video)))).toBe(true);
    expect(progress).toEqual([0.4, 0.8, 1, 1]);
  });

  it('after a dropped connection asks Drive what it has and goes on from there', async () => {
    script({ ok: true, session: SESSION });
    const video = file('VID_2.MP4', 2500, 'video/mp4');
    const drive = new FakeDrive(video.size);
    drive.install();
    drive.dropPart = 2;
    await uploadToDrive(SCRIPT, video, {}, 1000);
    expect(drive.puts).toEqual([
      'bytes 0-999/2500',
      'bytes 1000-1999/2500', // dropped
      'bytes */2500', // "what do you have?"
      'bytes 1000-1999/2500',
      'bytes 2000-2499/2500',
    ]);
    expect(drive.received).toHaveLength(2500);
  });

  it('passes on why the script refuses a file', async () => {
    script({ ok: false, error: 'too_large' });
    await expect(uploadToDrive(SCRIPT, file('a.jpg', 10))).rejects.toMatchObject({
      code: 'too_large',
    });
  });
});

describe('uploadToDrive, the older way (a script without sessions)', () => {
  it('sends a photo through the script as a CORS "simple" request', async () => {
    const fetch = script({ ok: true, service: 'album' }); // the old connection-test answer
    await uploadToDrive(SCRIPT, file('IMG_1.JPG', 7));

    const [url, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe(SCRIPT);
    expect(init.method).toBe('POST');
    // Apps Script answers no preflight: only a simple content type, nothing else.
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' });
    const body = JSON.parse(init.body as string) as Record<string, string>;
    expect(body.name).toBe('IMG_1.JPG');
    expect(Buffer.from(body.data!, 'base64')).toHaveLength(7);
  });

  it('cannot take videos', async () => {
    script({ ok: true, service: 'album' });
    await expect(uploadToDrive(SCRIPT, file('VID.MP4', 10, 'video/mp4'))).rejects.toMatchObject({
      code: 'invalid_payload',
    });
  });

  it('a failed request is a network error (retried by the queue)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const error = await uploadToDrive(SCRIPT, file('a.jpg', 3)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('network');
  });
});

describe('mediaType', () => {
  it('guesses photos and videos from the name when the phone leaves the type empty', () => {
    expect(mediaType(new File([], 'IMG_1.HEIC'))).toBe('image/heic');
    expect(mediaType(new File([], 'VID_1.MOV'))).toBe('video/quicktime');
    expect(mediaType(new File([], 'nota.txt'))).toBe('');
  });
});
