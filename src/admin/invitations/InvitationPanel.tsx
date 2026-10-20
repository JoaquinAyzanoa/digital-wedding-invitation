import { useCallback, useId, useState } from 'react';
import {
  adminErrorMessage,
  useDeleteInvitations,
  useInvitations,
  useMarkSent,
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
import { PdfButton } from './PdfButton';
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
  const markSent = useMarkSent();
  // After creating, the panel switches to the new invitation (to copy its link, etc.).
  const [created, setCreated] = useState<InvitationWithAttendees>();
  const currentId = created?.id ?? initial?.id;
  // Until the list refreshes, the row returned by the insert stands in for it: the panel
  // never goes back to "new" (a second tap would create a duplicate).
  const invitation = invitations.data?.find((i) => i.id === currentId) ?? created ?? initial;
  const [tab, setTab] = useState<Tab>('data');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Unsaved changes in the open tab: closing or switching tabs asks first (a tap on the
  // backdrop or Escape is easy to do by mistake on a phone).
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);
  const [pending, setPending] = useState<{ kind: 'close' } | { kind: 'tab'; tab: Tab } | null>(
    null,
  );

  function guarded(action: { kind: 'close' } | { kind: 'tab'; tab: Tab }) {
    if (dirty) setPending(action);
    else run(action);
  }

  function run(action: { kind: 'close' } | { kind: 'tab'; tab: Tab }) {
    setPending(null);
    setDirty(false);
    if (action.kind === 'close') onClose();
    else setTab(action.tab);
  }
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

  // Sending happens outside the web (the admin shares the PDF); this only keeps track.
  async function setSent(invitationId: string, sent: boolean) {
    try {
      await markSent.mutateAsync({ id: invitationId, sent });
      toast(sent ? 'Marcada como enviada' : 'Marcada como no enviada');
    } catch (error) {
      toast(adminErrorMessage(error));
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
      onClose={() => guarded({ kind: 'close' })}
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
            <div className={styles.linkActions}>
              <PdfButton invitation={invitation} />
            </div>
            <p className={ui.hint}>
              {invitation.sent_at
                ? `Enviada el ${new Date(invitation.sent_at).toLocaleDateString('es-PE', {
                    timeZone: 'America/Lima',
                    day: 'numeric',
                    month: 'long',
                  })}.`
                : 'Aún no se envía.'}{' '}
              <button
                type="button"
                className={styles.inlineLink}
                disabled={markSent.isPending}
                onClick={() => void setSent(invitation.id, !invitation.sent_at)}
              >
                {invitation.sent_at ? 'Marcar como no enviada' : 'Marcar como enviada'}
              </button>
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
                onClick={() => value !== tab && guarded({ kind: 'tab', tab: value })}
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
            onDirtyChange={onDirtyChange}
            onSaved={(row) => {
              if (!invitation) setCreated({ ...row, attendees: [] });
            }}
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
                onDirtyChange={onDirtyChange}
              />
            )}
          </>
        )}
      </div>

      {pending && (
        <ConfirmDialog
          title="¿Descartar los cambios?"
          message="Tienes cambios sin guardar en esta invitación."
          confirmLabel="Descartar"
          danger
          onConfirm={() => run(pending)}
          onCancel={() => setPending(null)}
        />
      )}

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
