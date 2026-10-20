import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationView, RsvpInput } from '@/shared/schemas/invitation';

/** Error codes raised by the RPCs (see the rpc migration), plus client-side ones. */
export const API_ERROR_CODES = [
  'invitation_not_found',
  'rsvp_closed',
  'invalid_attendees',
  'invalid_payload',
  'album_closed',
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

/** A photo ready to upload: compressed in the browser, with its thumbnail. */
export interface AlbumPhotoUpload {
  photo: Blob;
  thumb: Blob;
  /** File extension for both files: `webp`, `jpg` or `png`. */
  ext: string;
  width: number | null;
  height: number | null;
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
  /** Uploads a photo (and its thumbnail) to the album and registers it. */
  uploadAlbumPhoto(code: string, upload: AlbumPhotoUpload, options?: UploadOptions): Promise<void>;
}
