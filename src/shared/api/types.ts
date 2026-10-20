import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationView, RsvpInput } from '@/shared/schemas/invitation';

/** Error codes raised by the RPCs (see the rpc migration), plus client-side ones. */
export const API_ERROR_CODES = [
  'invitation_not_found',
  'rsvp_closed',
  'invalid_attendees',
  'invalid_payload',
  'album_closed',
  'album_full',
  'too_large',
  'forbidden',
  'content_invalid',
  'network',
  'unknown',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
  }
}

export interface GetInvitationOptions {
  /** Record the visit (first/last opened, open count). False for previews and the admin. */
  track?: boolean;
}

export interface UploadOptions {
  /** 0–1, as the bytes go out. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Everything the public invitation needs from the backend. */
export interface PublicApi {
  getContent(): Promise<PublicContent>;
  getInvitation(code: string, options?: GetInvitationOptions): Promise<InvitationView | null>;
  submitRsvp(code: string, rsvp: RsvpInput): Promise<InvitationView>;
  /** Sends an original photo to the album (Google Drive, through `uploadUrl`). */
  uploadAlbumPhoto(
    uploadUrl: string,
    code: string,
    file: File,
    options?: UploadOptions,
  ): Promise<void>;
}
