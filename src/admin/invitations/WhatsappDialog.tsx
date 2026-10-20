import { useState } from 'react';
import { useSiteContent } from '@/admin/data/content';
import { adminErrorMessage, useMarkSent } from '@/admin/data/queries';
import { Btn, BtnLink } from '@/admin/ui/Btn';
import { Modal } from '@/admin/ui/Modal';
import ui from '@/admin/ui/ui.module.css';
import type { InvitationRow } from '@/shared/schemas/invitationAdmin';
import { useToast } from '@/shared/toast/toastContext';
import { downloadBlob } from '@/shared/utils/download';
import { invitationLink } from '@/shared/utils/links';
import { renderTemplate, whatsappUrl } from '@/shared/utils/whatsapp';
import styles from './WhatsappDialog.module.css';
import { invitationPdf } from './pdf';
import type { WhatsappMode } from './whatsappMode';

interface WhatsappDialogProps {
  mode: WhatsappMode;
  invitation: Pick<InvitationRow, 'id' | 'code' | 'display_name' | 'seats' | 'phone' | 'sent_at'>;
  onClose: () => void;
}

/**
 * wa.me cannot attach files, so sending is three explicit steps: download the PDF, open
 * WhatsApp with the message (and attach the PDF there), then mark it as sent. Separate
 * buttons also keep phones from blocking a download or popup that follows a wait.
 */
export function WhatsappDialog({ mode, invitation, onClose }: WhatsappDialogProps) {
  const toast = useToast();
  const content = useSiteContent();
  const markSent = useMarkSent();
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'done'>('idle');

  const isInvite = mode === 'invite';
  const title = `${isInvite ? 'Enviar a' : 'Recordatorio para'} ${invitation.display_name}`;
  const close = (
    <Btn variant="secondary" onClick={onClose}>
      Cerrar
    </Btn>
  );

  if (content.isPending) {
    return (
      <Modal title={title} onClose={onClose} actions={close}>
        <p className={ui.muted}>Cargando…</p>
      </Modal>
    );
  }
  if (content.isError || content.data.isStarter) {
    return (
      <Modal title={title} onClose={onClose} actions={close}>
        <p>
          Primero guarda el contenido de la invitación (sección «Contenido»): el mensaje y el PDF
          salen de ahí.
        </p>
      </Modal>
    );
  }

  const site = content.data.public;
  const message = renderTemplate(
    isInvite ? site.whatsapp.inviteTemplate : site.whatsapp.reminderTemplate,
    {
      name: invitation.display_name,
      seats: invitation.seats,
      link: invitationLink(invitation.code),
    },
  );
  const url = whatsappUrl(invitation.phone, message);

  async function downloadPdf() {
    setPdfState('working');
    try {
      const { blob, fileName } = await invitationPdf(site, invitation);
      downloadBlob(blob, fileName);
      setPdfState('done');
    } catch (error) {
      setPdfState('idle');
      toast(adminErrorMessage(error));
    }
  }

  async function confirmSent() {
    try {
      await markSent.mutateAsync({ id: invitation.id, sent: true });
      toast('Marcada como enviada');
      onClose();
    } catch (error) {
      toast(adminErrorMessage(error));
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={
        isInvite ? (
          <>
            {close}
            <Btn onClick={confirmSent} disabled={markSent.isPending}>
              {invitation.sent_at ? 'Marcar enviada de nuevo' : 'Ya la envié'}
            </Btn>
          </>
        ) : (
          close
        )
      }
    >
      {!url && (
        <p className={ui.errorBox}>
          Esta invitación no tiene un teléfono válido. Agrégalo en «Datos» o copia el enlace y
          envíalo por otro medio.
        </p>
      )}

      <p className={styles.message}>{message}</p>

      <ol className={styles.steps}>
        {isInvite && (
          <li>
            <span>Descarga el PDF</span>
            <Btn
              size="sm"
              variant="secondary"
              onClick={downloadPdf}
              disabled={pdfState === 'working'}
            >
              {pdfState === 'working'
                ? 'Preparando…'
                : pdfState === 'done'
                  ? 'Descargado ✓'
                  : 'Descargar PDF'}
            </Btn>
          </li>
        )}
        <li>
          <span>
            {isInvite ? 'Abre WhatsApp y adjunta el PDF' : 'Abre WhatsApp y envía el mensaje'}
          </span>
          {url ? (
            <BtnLink
              size="sm"
              variant="primary"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir WhatsApp
            </BtnLink>
          ) : (
            <Btn size="sm" disabled>
              Abrir WhatsApp
            </Btn>
          )}
        </li>
        {isInvite && <li>Cuando lo hayas enviado, márcala como enviada.</li>}
      </ol>
    </Modal>
  );
}
