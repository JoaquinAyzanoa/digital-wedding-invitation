import { useState } from 'react';
import { useSiteContent } from '@/admin/data/content';
import { adminErrorMessage } from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import type { InvitationRow } from '@/shared/schemas/invitationAdmin';
import { useToast } from '@/shared/toast/toastContext';
import { downloadBlob } from '@/shared/utils/download';
import { invitationPdf } from './pdf';

/** "Descargar PDF" for one invitation (to print it or send it by another app). */
export function PdfButton({
  invitation,
}: {
  invitation: Pick<InvitationRow, 'code' | 'display_name' | 'seats'>;
}) {
  const toast = useToast();
  const content = useSiteContent();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!content.data || content.data.isStarter) {
      toast('Primero guarda el contenido de la invitación (sección «Contenido»).');
      return;
    }
    setBusy(true);
    try {
      const { blob, fileName } = await invitationPdf(content.data.public, invitation);
      downloadBlob(blob, fileName);
    } catch (error) {
      toast(adminErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Btn
      size="sm"
      variant="secondary"
      onClick={download}
      disabled={busy || content.isPending}
      aria-busy={busy}
    >
      {busy ? 'Preparando…' : 'Descargar PDF'}
    </Btn>
  );
}
