import ui from '@/admin/ui/ui.module.css';
import { UiIcon } from '@/shared/icons/UiIcon';
import {
  responseStatus,
  SIDE_LABELS,
  type InvitationWithAttendees,
  type Side,
} from '@/shared/schemas/invitationAdmin';
import { useToast } from '@/shared/toast/toastContext';
import { copyText } from '@/shared/utils/clipboard';
import { adminPreviewLink, invitationLink } from '@/shared/utils/links';
import styles from './InvitationRow.module.css';
import { useInvitationPdf } from './useInvitationPdf';

const STATUS_LABEL = { pending: 'Pendiente', attending: 'Asiste', declined: 'No asiste' };

interface InvitationRowProps {
  invitation: InvitationWithAttendees;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

export function InvitationRow({ invitation: i, selected, onToggle, onOpen }: InvitationRowProps) {
  const pdf = useInvitationPdf();
  const toast = useToast();
  const status = responseStatus(i);
  const people = status === 'attending' ? i.attendees.length : 0;

  return (
    <li className={styles.row} data-selected={selected}>
      <input
        type="checkbox"
        className={styles.check}
        checked={selected}
        onChange={onToggle}
        aria-label={`Seleccionar ${i.display_name}`}
      />
      <button
        type="button"
        className={styles.main}
        onClick={onOpen}
        aria-label={`Editar ${i.display_name}`}
      >
        <span className={styles.name}>{i.display_name}</span>
        <span className={styles.meta}>
          <code>{i.code}</code>
          {' · '}
          {i.seats} {i.seats === 1 ? 'pase' : 'pases'}
          {' · '}
          {SIDE_LABELS[i.side as Side]}
          {i.group_name && ` · ${i.group_name}`}
        </span>
        <span className={styles.badges}>
          <span className={ui.badge} data-tone={status}>
            {STATUS_LABEL[status]}
            {status === 'attending' && ` · ${people}`}
          </span>
          {i.first_opened_at ? (
            <span className={ui.badge} data-tone="info">
              Abierta{i.open_count > 1 ? ` ×${i.open_count}` : ''}
            </span>
          ) : i.sent_at ? (
            <span className={ui.badge}>Enviada</span>
          ) : null}
        </span>
      </button>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.icon}
          aria-label={`Descargar PDF de ${i.display_name}`}
          title="Descargar PDF"
          disabled={pdf.busy}
          aria-busy={pdf.busy}
          onClick={() => pdf.download(i)}
        >
          <UiIcon name="download" size={20} />
        </button>
        <button
          type="button"
          className={styles.icon}
          aria-label={`Copiar enlace de ${i.display_name}`}
          title="Copiar enlace"
          onClick={async () =>
            toast((await copyText(invitationLink(i.code))) ? 'Enlace copiado' : 'No se pudo copiar')
          }
        >
          <UiIcon name="copy" size={18} />
        </button>
        <a
          className={styles.icon}
          href={adminPreviewLink(i.code)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir la invitación de ${i.display_name} (no cuenta como visita)`}
          title="Abrir invitación"
        >
          <UiIcon name="external" size={18} />
        </a>
      </div>
    </li>
  );
}
