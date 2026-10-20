import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationRow } from '@/shared/schemas/invitationAdmin';
import { invitationLink } from '@/shared/utils/links';

/** The guest's PDF (name, seats, personal QR). The PDF library loads on first use. */
export async function invitationPdf(
  content: PublicContent,
  row: Pick<InvitationRow, 'code' | 'display_name' | 'seats'>,
) {
  const { generateInvitationPdf } = await import('@/shared/pdf/generate');
  return generateInvitationPdf({
    content,
    guest: { displayName: row.display_name, seats: row.seats },
    link: invitationLink(row.code),
  });
}
