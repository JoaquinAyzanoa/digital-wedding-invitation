import { Btn } from '@/admin/ui/Btn';
import type { InvitationRow } from '@/shared/schemas/invitationAdmin';
import { useInvitationPdf } from './useInvitationPdf';

/** "Descargar PDF" for one invitation: name, seats and the QR to their personal link. */
export function PdfButton({
  invitation,
}: {
  invitation: Pick<InvitationRow, 'code' | 'display_name' | 'seats'>;
}) {
  const pdf = useInvitationPdf();
  return (
    <Btn
      size="sm"
      onClick={() => pdf.download(invitation)}
      disabled={pdf.busy}
      aria-busy={pdf.busy}
    >
      {pdf.busy ? 'Preparando…' : 'Descargar PDF'}
    </Btn>
  );
}
