import { demoContent, demoInvitation } from '@/demo/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import { ApiError, type PublicApi } from './types';

export const DEMO_CODE = 'demo';

/** In-memory backend for `?i=demo`, the admin preview and running without Supabase. */
export function createDemoApi(): PublicApi {
  let invitation: InvitationView = structuredClone(demoInvitation);

  return {
    async getContent() {
      return demoContent;
    },

    async getInvitation(code) {
      return code.trim().toLowerCase() === DEMO_CODE ? invitation : null;
    },

    async submitRsvp(code, rsvp) {
      if (code.trim().toLowerCase() !== DEMO_CODE) throw new ApiError('invitation_not_found');
      if (!invitation.rsvpOpen) throw new ApiError('rsvp_closed');
      if (
        rsvp.attending &&
        (rsvp.attendees.length < 1 || rsvp.attendees.length > invitation.seats)
      ) {
        throw new ApiError('invalid_attendees');
      }

      invitation = {
        ...invitation,
        response: {
          attending: rsvp.attending,
          parts: rsvp.attending
            ? { ceremony: rsvp.parts?.ceremony ?? true, reception: rsvp.parts?.reception ?? true }
            : { ceremony: null, reception: null },
          needsTransport: rsvp.attending ? (rsvp.needsTransport ?? null) : null,
          needsLodging: rsvp.attending ? (rsvp.needsLodging ?? null) : null,
          contactPhone: rsvp.contactPhone || null,
          songRequest: rsvp.attending ? rsvp.songRequest || null : null,
          message: rsvp.message || null,
          respondedAt: new Date().toISOString(),
          attendees: rsvp.attending
            ? rsvp.attendees.map((a) => ({
                fullName: a.fullName.trim(),
                kind: a.kind,
                age: a.kind === 'child' ? a.age : null,
                menu: a.menu || null,
                dietary: a.dietary || null,
                // Like the server: only the last 3 digits come back.
                dniHint: a.dni ? a.dni.slice(-3) : null,
              }))
            : [],
        },
      };
      return invitation;
    },

    /** Nothing is stored: the progress runs as if the photo went out. */
    async uploadAlbumPhoto(_url, _file, { onProgress, signal } = {}) {
      for (let step = 1; step <= 5; step++) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        onProgress?.(step / 5);
      }
    },
  };
}
