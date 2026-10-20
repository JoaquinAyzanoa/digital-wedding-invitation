import type { PrivateContent } from './content';

/** Shape returned by the `get_invitation` and `submit_rsvp` RPCs. */
export interface InvitationView {
  code: string;
  displayName: string;
  seats: number;
  rsvpOpen: boolean;
  albumOpen: boolean;
  response: RsvpResponse | null;
  private: PrivateContent;
}

export interface RsvpResponse {
  attending: boolean;
  parts: { ceremony: boolean | null; reception: boolean | null };
  needsTransport: boolean | null;
  needsLodging: boolean | null;
  contactPhone: string | null;
  songRequest: string | null;
  message: string | null;
  respondedAt: string;
  attendees: Array<{
    fullName: string;
    kind: 'adult' | 'child';
    age: number | null;
    menu: string | null;
    dietary: string | null;
  }>;
}

/** Payload of `submit_rsvp` (validated again on the server). */
export interface RsvpInput {
  attending: boolean;
  parts?: { ceremony: boolean; reception: boolean };
  attendees: Array<{
    fullName: string;
    kind: 'adult' | 'child';
    age: number | null;
    menu: string | null;
    dietary: string | null;
  }>;
  needsTransport?: boolean | null;
  needsLodging?: boolean | null;
  contactPhone?: string | null;
  songRequest?: string | null;
  message?: string | null;
}
