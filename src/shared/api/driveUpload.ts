import { API_ERROR_CODES, ApiError, type ApiErrorCode, type UploadOptions } from './types';

/** Some phones leave the type empty (HEIC from a file manager): guess it from the name. */
export function photoType(file: File): string {
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
  };
  return types[ext] ?? '';
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
 * Sends the original photo (not recompressed) to the Apps Script web app, which saves it in
 * the couple's Google Drive. Plain text body: a "simple" request without CORS preflight, which
 * Apps Script cannot answer; its JSON reply comes back after a redirect. XHR rather than
 * fetch: it reports upload progress.
 */
export async function uploadToDrive(
  uploadUrl: string,
  code: string,
  file: File,
  { onProgress, signal }: UploadOptions = {},
): Promise<void> {
  const body = JSON.stringify({
    code,
    name: file.name,
    type: photoType(file),
    data: await readBase64(file),
  });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let reply: { ok?: boolean; error?: string } = {};
      try {
        reply = JSON.parse(xhr.responseText);
      } catch {
        // not JSON (an error page): unknown
      }
      if (xhr.status === 200 && reply.ok) return resolve();
      const code = (API_ERROR_CODES as readonly string[]).includes(reply.error ?? '')
        ? (reply.error as ApiErrorCode)
        : 'unknown';
      reject(new ApiError(code, xhr.responseText.slice(0, 200)));
    };
    xhr.onerror = () => reject(new ApiError('network'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}
