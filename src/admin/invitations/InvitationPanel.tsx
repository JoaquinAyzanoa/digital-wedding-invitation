import { useId, useState } from 'react';
import {
  adminErrorMessage,
  useDeleteInvitations,
  useInvitations,
  useRsvpRules,
} from '@/admin/data/queries';
import { Btn, BtnLink } from '@/admin/ui/Btn';
import { ConfirmDialog } from '@/admin/ui/ConfirmDialog';
import { Drawer } from '@/admin/ui/Drawer';
import ui from '@/admin/ui/ui.module.css';
import type { InvitationWithAttendees } from '@/shared/schemas/invitationAdmin';
import { useToast } from '@/shared/toast/toastContext';
import { copyText } from '@/shared/utils/clipboard';
import { adminPreviewLink, invitationLink } from '@/shared/utils/links';
import { groupsOf } from './filters';
import { InvitationDataForm } from './InvitationDataForm';
import styles from './InvitationPanel.module.css';
import { RsvpEditor } from './RsvpEditor';

type Tab = 'data' | 'rsvp';

interface InvitationPanelProps {
  /** Missing for a new invitation. */
  invitation?: InvitationWithAttendees;
  onClose: () => void;
}

export function InvitationPanel({ invitation: initial, onClose }: InvitationPanelProps) {
  const id = useId();
  const toast = useToast();
  const invitations = useInvitations();
  const rules = useRsvpRules();
  const remove = useDeleteInvitations();
  // After creating, the panel switches to the new invitation (to copy its link, etc.).
  const [currentId, setCurrentId] = useState(initial?.id);
  const invitation = invitations.data?.find((i) => i.id === currentId) ?? initial;
  const [tab, setTab] = useState<Tab>('data');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dataFormId = `${id}-data`;
  const rsvpFormId = `${id}-rsvp`;

  async function deleteInvitation() {
    if (!invitation) return;
    try {
      await remove.mutateAsync([invitation.id]);
      toast('Invitación eliminada');
      onClose();
    } catch (error) {
      toast(adminErrorMessage(error));
      setConfirmDelete(false);
    }
  }

  const footer =
    tab === 'data' ? (
      <>
        {invitation && (
          <Btn variant="ghost" className={styles.delete} onClick={() => setConfirmDelete(true)}>
            Eliminar
          </Btn>
        )}
        <Btn type="submit" form={dataFormId} disabled={busy}>
          {busy ? 'Guardando…' : invitation ? 'Guardar cambios' : 'Crear invitación'}
        </Btn>
      </>
    ) : (
      <Btn type="submit" form={rsvpFormId} disabled={busy || !rules.data}>
        {busy ? 'Guardando…' : 'Guardar respuesta'}
      </Btn>
    );

  return (
    <Drawer
      title={invitation ? invitation.display_name : 'Nueva invitación'}
      onClose={onClose}
      footer={footer}
    >
      {invitation && (
        <>
          <div className={styles.linkBox}>
            <code className={styles.link}>{invitationLink(invitation.code)}</code>
            <div className={styles.linkActions}>
              <Btn
                size="sm"
                variant="secondary"
                onClick={async () =>
                  toast(
                    (await copyText(invitationLink(invitation.code)))
                      ? 'Enlace copiado'
                      : 'No se pudo copiar',
                  )
                }
              >
                Copiar enlace
              </Btn>
              <BtnLink
                size="sm"
                href={adminPreviewLink(invitation.code)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir
              </BtnLink>
            </div>
            <p className={ui.hint}>
              {invitation.first_opened_at
                ? `La abrió ${invitation.open_count} ${invitation.open_count === 1 ? 'vez' : 'veces'}.`
                : 'Todavía no la abre.'}{' '}
              Abrirla desde aquí no cuenta como visita.
            </p>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Secciones">
            {(
              [
                ['data', 'Datos'],
                ['rsvp', 'Respuesta'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`${id}-tab-${value}`}
                aria-selected={tab === value}
                aria-controls={`${id}-panel`}
                className={styles.tab}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div
        id={`${id}-panel`}
        role={invitation ? 'tabpanel' : undefined}
        aria-labelledby={invitation ? `${id}-tab-${tab}` : undefined}
      >
        {tab === 'data' && (
          <InvitationDataForm
            key={invitation?.id ?? 'new'}
            formId={dataFormId}
            invitation={invitation}
            confirmedPeople={invitation?.attending ? invitation.attendees.length : 0}
            groups={groupsOf(invitations.data ?? [])}
            onBusyChange={setBusy}
            onSaved={(row) => setCurrentId(row.id)}
          />
        )}

        {tab === 'rsvp' && invitation && (
          <>
            {rules.isPending && <p className={ui.muted}>Cargando…</p>}
            {rules.isError && <p className={ui.errorBox}>{adminErrorMessage(rules.error)}</p>}
            {rules.data && (
              <RsvpEditor
                // Remount after saving so the form starts from what the database returned.
                key={`${invitation.id}-${invitation.updated_at}`}
                formId={rsvpFormId}
                invitation={invitation}
                rules={rules.data}
                onBusyChange={setBusy}
              />
            )}
          </>
        )}
      </div>

      {confirmDelete && invitation && (
        <ConfirmDialog
          title={`¿Eliminar "${invitation.display_name}"?`}
          message="Se borran también su respuesta y asistentes. El enlace dejará de funcionar."
          confirmLabel="Eliminar"
          danger
          busy={remove.isPending}
          onConfirm={deleteInvitation}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Drawer>
  );
}
