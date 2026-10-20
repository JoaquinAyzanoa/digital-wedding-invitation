import type { SupabaseClient } from '@supabase/supabase-js';
import { publicContentSchema } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import type { Database, Json } from '@/shared/types/database.types';
import { uuid } from '@/shared/utils/uuid';
import {
  API_ERROR_CODES,
  ApiError,
  type ApiErrorCode,
  type PublicApi,
  type UploadOptions,
} from './types';

type Client = SupabaseClient<Database>;

let publicClient: Promise<Client> | null = null;

/** The guest-facing client: no session, loaded on first use so demo mode never downloads it. */
function getPublicClient(): Promise<Client> {
  publicClient ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    ),
  );
  return publicClient;
}

/** Maps a PostgREST error to our typed codes: RPCs raise the code as the message. */
export function toApiError(error: { message?: string; code?: string }): ApiError {
  const message = error.message ?? '';
  if ((API_ERROR_CODES as readonly string[]).includes(message)) {
    return new ApiError(message as ApiErrorCode);
  }
  if (!error.code && /fetch|network|load failed/i.test(message)) {
    return new ApiError('network', message);
  }
  return new ApiError('unknown', message);
}

/**
 * Uploads one file to the album bucket. XHR rather than supabase-js: it reports upload
 * progress. Storage answers 400 with the real status in the body: 403 when the policy
 * refuses (unknown code, album closed or full), 409 when the file is already there (a retry
 * after a lost answer), which counts as done.
 */
function putAlbumObject(path: string, file: Blob, { onProgress, signal }: UploadOptions = {}) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/album/${path}`);
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let status = String(xhr.status);
      try {
        status = String((JSON.parse(xhr.responseText) as { statusCode?: string }).statusCode);
      } catch {
        // not JSON: keep the HTTP status
      }
      if (status === '409') return resolve();
      reject(new ApiError(status === '403' ? 'album_closed' : 'unknown', xhr.responseText));
    };
    xhr.onerror = () => reject(new ApiError('network'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

export function createSupabaseApi(): PublicApi {
  return {
    async getContent() {
      const client = await getPublicClient();
      const { data, error } = await client.rpc('get_content');
      if (error) throw toApiError(error);

      const parsed = publicContentSchema.safeParse(data);
      if (!parsed.success) {
        console.warn('site_content.public_data does not match the schema', parsed.error.issues);
        throw new ApiError('content_invalid');
      }
      return parsed.data;
    },

    async getInvitation(code, { track = true } = {}) {
      const client = await getPublicClient();
      const { data, error } = await client.rpc('get_invitation', { p_code: code, p_track: track });
      if (error) throw toApiError(error);
      return (data as unknown as InvitationView | null) ?? null;
    },

    async submitRsvp(code, rsvp) {
      const client = await getPublicClient();
      const { data, error } = await client.rpc('submit_rsvp', {
        p_code: code,
        p_payload: rsvp as unknown as Json,
      });
      if (error) throw toApiError(error);
      return data as unknown as InvitationView;
    },

    async uploadAlbumPhoto(code, upload, { onProgress, signal } = {}) {
      const name = uuid();
      const path = `${code}/${name}.${upload.ext}`;
      // The thumbnail is small: it goes first and counts little in the progress.
      const total = upload.photo.size + upload.thumb.size;
      await putAlbumObject(`${code}/${name}.thumb.${upload.ext}`, upload.thumb, {
        signal,
        onProgress: (f) => onProgress?.((f * upload.thumb.size) / total),
      });
      await putAlbumObject(path, upload.photo, {
        signal,
        onProgress: (f) => onProgress?.((upload.thumb.size + f * upload.photo.size) / total),
      });
      const client = await getPublicClient();
      const { error } = await client.rpc('register_album_photo', {
        p_code: code,
        p_path: path,
        p_meta: { width: upload.width, height: upload.height, bytes: upload.photo.size },
      });
      if (error) throw toApiError(error);
    },
  };
}
