import type { InvitationRow } from '@/shared/schemas/invitationAdmin';

export type WhatsappMode = 'invite' | 'reminder';

/** Sent but not answered yet: a reminder. Otherwise: (re)send the invitation. */
export function whatsappModeFor(row: Pick<InvitationRow, 'sent_at' | 'attending'>): WhatsappMode {
  return row.sent_at && row.attending === null ? 'reminder' : 'invite';
}
