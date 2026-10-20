import type { RsvpResponse } from '@/shared/schemas/invitation';
import type { InvitationWithAttendees } from '@/shared/schemas/invitationAdmin';

/** The guest's answer stored in the row, in the shape the RSVP helpers expect. */
export function responseFromRow(row: InvitationWithAttendees): RsvpResponse | null {
  if (row.attending === null) return null;
  return {
    attending: row.attending,
    parts: { ceremony: row.attends_ceremony, reception: row.attends_reception },
    needsTransport: row.needs_transport,
    needsLodging: row.needs_lodging,
    contactPhone: row.contact_phone,
    songRequest: row.song_request,
    message: row.message,
    respondedAt: row.responded_at ?? row.updated_at,
    attendees: [...row.attendees]
      .sort((a, b) => a.position - b.position)
      .map((a) => ({
        fullName: a.full_name,
        kind: a.kind as 'adult' | 'child',
        age: a.age,
        menu: a.menu,
        dietary: a.dietary,
      })),
  };
}
