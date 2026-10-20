import { useState } from 'react';
import { useSiteContent } from '@/admin/data/content';
import { adminErrorMessage } from '@/admin/data/queries';
import type { InvitationRow } from '@/shared/schemas/invitationAdmin';
import { useToast } from '@/shared/toast/toastContext';
import { downloadBlob } from '@/shared/utils/download';
import { invitationPdf } from './pdf';

/** Downloads one invitation's PDF (the admin then sends it by hand). */
export function useInvitationPdf() {
  const toast = useToast();
  const content = useSiteContent();
  const [busy, setBusy] = useState(false);

  async function download(invitation: Pick<InvitationRow, 'code' | 'display_name' | 'seats'>) {
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

  return { download, busy: busy || content.isPending };
}
