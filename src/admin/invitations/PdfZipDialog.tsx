import { useEffect, useState } from 'react';
import { useSiteContent } from '@/admin/data/content';
import { adminErrorMessage } from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import { Modal } from '@/admin/ui/Modal';
import ui from '@/admin/ui/ui.module.css';
import type { InvitationRow } from '@/shared/schemas/invitationAdmin';
import { downloadBlob } from '@/shared/utils/download';
import styles from './PdfZipDialog.module.css';
import { invitationPdf } from './pdf';

interface PdfZipDialogProps {
  invitations: Pick<InvitationRow, 'id' | 'code' | 'display_name' | 'seats'>[];
  onClose: () => void;
}

/** One PDF per invitation, generated one after another, then downloaded as a ZIP. */
export function PdfZipDialog({ invitations, onClose }: PdfZipDialogProps) {
  const content = useSiteContent();
  const [done, setDone] = useState(0);
  const [state, setState] = useState<'working' | 'finished' | 'error'>('working');
  const [error, setError] = useState('');

  useEffect(() => {
    const site = content.data && !content.data.isStarter ? content.data.public : null;
    if (!site) return;
    // Per run: a rerun (or closing the dialog) stops this loop without restarting it.
    let cancelled = false;
    void (async () => {
      try {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const names = new Set<string>();
        for (const [index, invitation] of invitations.entries()) {
          if (cancelled) return;
          const { blob, fileName } = await invitationPdf(site, invitation);
          // Two guests with the same name must not overwrite each other in the ZIP.
          const unique = names.has(fileName)
            ? fileName.replace(/\.pdf$/, `-${invitation.code}.pdf`)
            : fileName;
          names.add(unique);
          zip.file(unique, blob);
          setDone(index + 1);
        }
        if (cancelled) return;
        const archive = await zip.generateAsync({ type: 'blob' });
        downloadBlob(archive, `invitaciones-pdf-${new Date().toISOString().slice(0, 10)}.zip`);
        setState('finished');
      } catch (cause) {
        if (cancelled) return;
        setError(adminErrorMessage(cause));
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content.data, invitations]);

  const total = invitations.length;
  const notReady = content.data?.isStarter || content.isError;

  return (
    <Modal
      title="Descargar PDFs"
      onClose={onClose}
      actions={
        <Btn variant={state === 'working' ? 'secondary' : 'primary'} onClick={onClose}>
          {state === 'working' && !notReady ? 'Cancelar' : 'Cerrar'}
        </Btn>
      }
    >
      {notReady ? (
        <p>Primero guarda el contenido de la invitación (sección «Contenido»).</p>
      ) : state === 'error' ? (
        <p className={ui.errorBox}>{error}</p>
      ) : (
        <>
          <p role="status">
            {state === 'finished'
              ? `Listo: ${total} PDFs en el ZIP.`
              : `Preparando PDF ${Math.min(done + 1, total)} de ${total}…`}
          </p>
          <progress className={styles.progress} max={total} value={done} />
        </>
      )}
    </Modal>
  );
}
