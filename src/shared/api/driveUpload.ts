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
 * the couple's Google Drive. It must stay a CORS "simple" request: Apps Script never answers
 * a preflight, so the browser would cancel anything that needs one. That is why the body is
 * plain text, there are no custom headers and no upload-progress listener (watching an XHR
 * upload's progress alone forces a preflight). The JSON reply comes back after a redirect.
 */
export async function uploadToDrive(
  uploadUrl: string,
  file: File,
  { signal }: UploadOptions = {},
): Promise<void> {
  const body = JSON.stringify({
    name: file.name,
    type: photoType(file),
    data: await readBase64(file),
  });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

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
  const text = await response.text();
  let reply: { ok?: boolean; error?: string } = {};
  try {
    reply = JSON.parse(text);
  } catch {
    // not JSON (an error page): unknown
  }
  if (response.ok && reply.ok) return;
  const code = (API_ERROR_CODES as readonly string[]).includes(reply.error ?? '')
    ? (reply.error as ApiErrorCode)
    : 'unknown';
  throw new ApiError(code, text.slice(0, 200));
}
