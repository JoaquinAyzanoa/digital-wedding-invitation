import { API_ERROR_CODES, ApiError, type ApiErrorCode, type UploadOptions } from './types';

/** Some phones leave the type empty (HEIC or MOV from a file manager): guess it from the name. */
export function mediaType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    heif: 'image/heif',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    m4v: 'video/x-m4v',
    mov: 'video/quicktime',
    '3gp': 'video/3gpp',
    webm: 'video/webm',
  };
  return types[ext] ?? '';
}

/** Parts sent to Drive one after another (a multiple of 256 KiB, as Drive requires). */
export const CHUNK_BYTES = 8 * 1024 * 1024;
/** Dropped connections survived per file before giving up (the queue then retries it whole). */
const CHUNK_RETRIES = 4;

function apiError(code: string | undefined, detail: string): ApiError {
  return new ApiError(
    (API_ERROR_CODES as readonly string[]).includes(code ?? '')
      ? (code as ApiErrorCode)
      : 'unknown',
    detail.slice(0, 200),
  );
}

async function readJson(
  response: Response,
): Promise<{ ok?: boolean; error?: string; session?: string }> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw apiError(undefined, text); // not JSON (an error page)
  }
}

/**
 * Asks the Apps Script web app for a Drive upload session for this file. Null when the
 * script predates sessions (it answers its connection test instead): then the older way.
 */
async function requestSession(uploadUrl: string, file: File, type: string, signal?: AbortSignal) {
  const query = new URLSearchParams({
    action: 'session',
    name: file.name,
    type,
    size: String(file.size),
    // Drive only lets the browser of this origin use the session (CORS).
    origin: window.location.origin,
  });
  let response: Response;
  try {
    response = await fetch(`${uploadUrl}?${query}`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('network');
  }
  const reply = await readJson(response);
  if (!reply.ok) throw apiError(reply.error, JSON.stringify(reply));
  return reply.session ?? null;
}

interface PutResult {
  status: number;
  /** Last byte Drive has, from `Range: bytes=0-N` (−1 when it has none). */
  received: number;
}

/** One PUT to the session (a part, or an empty status query). Network failures reject. */
function put(
  session: string,
  range: string,
  body: Blob | null,
  onSent: (bytes: number) => void,
  signal?: AbortSignal,
): Promise<PutResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', session);
    xhr.setRequestHeader('Content-Range', range);
    // Drive answers CORS preflights (unlike Apps Script), so progress can be watched here.
    xhr.upload.onprogress = (event) => onSent(event.loaded);
    xhr.onload = () => {
      const last = /bytes=0-(\d+)/.exec(xhr.getResponseHeader('Range') ?? '')?.[1];
      resolve({ status: xhr.status, received: last === undefined ? -1 : Number(last) });
    };
    xhr.onerror = () => reject(new ApiError('network'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends the file to the session in parts. Drive answers 308 with what it has after each part
 * and 200/201 at the end; after a dropped connection it is asked what it has and the upload
 * goes on from there instead of starting over (videos are big, phones lose signal).
 */
async function sendInParts(
  session: string,
  file: File,
  onProgress: ((fraction: number) => void) | undefined,
  signal: AbortSignal | undefined,
  chunkBytes: number,
) {
  const size = file.size;
  let offset = 0;
  let failures = 0;
  while (offset < size) {
    const end = Math.min(offset + chunkBytes, size);
    let result: PutResult;
    try {
      result = await put(
        session,
        `bytes ${offset}-${end - 1}/${size}`,
        file.slice(offset, end),
        (sent) => onProgress?.((offset + sent) / size),
        signal,
      );
    } catch (error) {
      if (signal?.aborted || !(error instanceof ApiError) || ++failures > CHUNK_RETRIES) {
        throw error;
      }
      await pause(1000 * failures);
      try {
        result = await put(session, `bytes */${size}`, null, () => {}, signal);
      } catch {
        continue; // still offline: try the same part again
      }
    }
    if (result.status === 200 || result.status === 201) {
      onProgress?.(1);
      return;
    }
    if (result.status !== 308) {
      // 404/410: the session expired; anything else is Drive refusing. The queue retries.
      throw new ApiError(
        result.status >= 500 || result.status === 404 || result.status === 410
          ? 'network'
          : 'unknown',
        `Drive ${result.status}`,
      );
    }
    offset = result.received + 1;
  }
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // "data:image/jpeg;base64,AAAA…" → "AAAA…"
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new ApiError('unknown', 'read_failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * The older, slower way, for a script that predates sessions: the whole photo through the
 * Apps Script web app, as base64 in a CORS "simple" request (plain text, no custom headers,
 * no progress listener: Apps Script never answers a preflight, so the browser would cancel
 * anything that needs one). Photos only.
 */
async function sendThroughScript(
  uploadUrl: string,
  file: File,
  type: string,
  signal?: AbortSignal,
) {
  if (!type.startsWith('image/')) throw new ApiError('invalid_payload', 'videos need sessions');
  const body = JSON.stringify({ name: file.name, type, data: await readBase64(file) });
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('network');
  }
  const reply = await readJson(response);
  if (!response.ok || !reply.ok) throw apiError(reply.error, JSON.stringify(reply));
}

/**
 * Sends an original photo or video (never recompressed) to the couple's Google Drive: the
 * Apps Script web app gives a one-file upload session and the browser sends the file straight
 * to Drive, fast and with real progress. Falls back to the older way with an older script.
 */
export async function uploadToDrive(
  uploadUrl: string,
  file: File,
  { onProgress, signal }: UploadOptions = {},
  chunkBytes = CHUNK_BYTES,
): Promise<void> {
  const type = mediaType(file);
  const session = await requestSession(uploadUrl, file, type, signal);
  if (session) return sendInParts(session, file, onProgress, signal, chunkBytes);
  return sendThroughScript(uploadUrl, file, type, signal);
}
