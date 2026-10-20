import { useState } from 'react';
import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import { useToast } from '@/shared/toast/toastContext';
import { Button } from '@/shared/ui/Button';
import { downloadBlob } from '@/shared/utils/download';
import { invitationLink } from '@/shared/utils/links';

interface DownloadPdfButtonProps {
  content: PublicContent;
  invitation: Pick<InvitationView, 'code' | 'displayName' | 'seats'>;
  variant?: 'primary' | 'outline';
}

/** "Descargar mi invitación (PDF)": generated in the browser, library loaded on the tap. */
export function DownloadPdfButton({
  content,
  invitation,
  variant = 'outline',
}: DownloadPdfButtonProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { generateInvitationPdf } = await import('@/shared/pdf/generate');
      const { blob, fileName } = await generateInvitationPdf({
        content,
        guest: { displayName: invitation.displayName, seats: invitation.seats },
        link: invitationLink(invitation.code),
      });
      downloadBlob(blob, fileName);
    } catch {
      toast('No pudimos preparar el PDF. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} onClick={download} disabled={busy} aria-busy={busy}>
      {busy ? 'Preparando PDF…' : 'Descargar mi invitación (PDF)'}
    </Button>
  );
}
