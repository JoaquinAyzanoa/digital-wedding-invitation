import type { SupabaseClient } from '@supabase/supabase-js';
import { publicContentSchema } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import type { Database, Json } from '@/shared/types/database.types';
import { uploadToDrive } from './driveUpload';
import { API_ERROR_CODES, ApiError, type ApiErrorCode, type PublicApi } from './types';

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

    uploadAlbumPhoto: uploadToDrive,
  };
}
