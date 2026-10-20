import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form';
import {
  adminErrorMessage,
  useResetRsvp,
  useSaveRsvp,
  type AdminRsvpRules,
} from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import { ConfirmDialog } from '@/admin/ui/ConfirmDialog';
import ui from '@/admin/ui/ui.module.css';
import type { InvitationWithAttendees } from '@/shared/schemas/invitationAdmin';
import {
  emptyAttendee,
  rsvpDefaults,
  rsvpFormSchema,
  toRsvpInput,
  type RsvpFormValues,
} from '@/shared/schemas/rsvp';
import { useToast } from '@/shared/toast/toastContext';
import { responseFromRow } from './responseFromRow';
import styles from './InvitationPanel.module.css';

type Status = 'pending' | 'attending' | 'declined';

/**
 * The guest form asks transport/lodging as yes/no (required). Here they are checkboxes,
 * so an untouched one means "no", not "unanswered".
 */
function adminDefaults(invitation: InvitationWithAttendees, rules: AdminRsvpRules): RsvpFormValues {
  const values = rsvpDefaults({
    displayName: invitation.display_name,
    seats: invitation.seats,
    response: responseFromRow(invitation),
  });
  return {
    ...values,
    needsTransport: rules.questions.transport ? (values.needsTransport ?? false) : null,
    needsLodging: rules.questions.lodging ? (values.needsLodging ?? false) : null,
  };
}

interface RsvpEditorProps {
  formId: string;
  invitation: InvitationWithAttendees;
  rules: AdminRsvpRules;
  onBusyChange: (busy: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
}

/** Loads or edits the answer on the guest's behalf (e.g. they confirmed by phone). */
export function RsvpEditor({
  formId,
  invitation,
  rules,
  onBusyChange,
  onDirtyChange,
}: RsvpEditorProps) {
  const id = useId();
  const toast = useToast();
  const saveRsvp = useSaveRsvp();
  const resetRsvp = useResetRsvp();
  const initial: Status =
    invitation.attending === null ? 'pending' : invitation.attending ? 'attending' : 'declined';
  const [status, setStatus] = useState<Status>(initial);
  const [confirmReset, setConfirmReset] = useState(false);

  const schema = useMemo(
    () =>
      rsvpFormSchema({
        seats: invitation.seats,
        menuOptions: rules.menuOptions,
        questions: rules.questions,
      }),
    [invitation.seats, rules],
  );
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<RsvpFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<RsvpFormValues>,
    defaultValues: adminDefaults(invitation, rules),
  });
  const attendees = useFieldArray({ control, name: 'attendees' });
  const kinds = useWatch({ control, name: 'attendees' });
  const needsTransport = useWatch({ control, name: 'needsTransport' });
  const needsLodging = useWatch({ control, name: 'needsLodging' });

  // Changing the status alone is also a change worth keeping.
  const dirty = isDirty || status !== initial;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  function chooseStatus(next: Status) {
    setStatus(next);
    setValue('attending', next === 'pending' ? null : next === 'attending');
  }

  async function reset() {
    onBusyChange(true);
    try {
      await resetRsvp.mutateAsync(invitation.id);
      toast('Respuesta reiniciada: queda pendiente');
    } catch (error) {
      toast(adminErrorMessage(error));
    } finally {
      onBusyChange(false);
      setConfirmReset(false);
    }
  }

  const submit = handleSubmit(async () => {
    onBusyChange(true);
    try {
      await saveRsvp.mutateAsync({
        id: invitation.id,
        rsvp: toRsvpInput(getValues(), rules.questions),
      });
      toast('Respuesta guardada');
    } catch (error) {
      toast(adminErrorMessage(error));
    } finally {
      onBusyChange(false);
    }
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (status === 'pending') {
      // Going back to pending deletes the answer: ask first.
      if (initial !== 'pending') setConfirmReset(true);
      return;
    }
    void submit();
  }

  const fieldError = (message?: string, errorId?: string) =>
    message ? (
      <span id={errorId} className={ui.error}>
        {message}
      </span>
    ) : null;

  return (
    <form id={formId} className={styles.form} onSubmit={onSubmit} noValidate>
      <fieldset className={styles.fieldset}>
        <legend className={ui.label}>Respuesta</legend>
        <div className={styles.segments}>
          {(
            [
              ['pending', 'Pendiente'],
              ['attending', 'Asiste'],
              ['declined', 'No asiste'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={styles.segment} data-checked={status === value}>
              <input
                type="radio"
                name={`${id}-status`}
                className="visually-hidden"
                checked={status === value}
                onChange={() => chooseStatus(value)}
              />
              {label}
            </label>
          ))}
        </div>
        {fieldError(errors.attending?.message)}
      </fieldset>

      {invitation.responded_at && (
        <p className={ui.hint}>
          Respondió el{' '}
          {new Date(invitation.responded_at).toLocaleString('es-PE', {
            timeZone: 'America/Lima',
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      )}

      {status === 'attending' && (
        <>
          {attendees.fields.map((item, index) => {
            const e = errors.attendees?.[index];
            const kind = kinds?.[index]?.kind;
            const fid = (name: string) => `${id}-a${index}-${name}`;
            return (
              <div key={item.id} className={ui.card} role="group" aria-labelledby={fid('title')}>
                <div className={styles.cardHeader}>
                  <h3 id={fid('title')} className={styles.cardTitle}>
                    Persona {index + 1}
                  </h3>
                  {attendees.fields.length > 1 && (
                    <Btn size="sm" variant="ghost" onClick={() => attendees.remove(index)}>
                      Quitar
                    </Btn>
                  )}
                </div>
                <div className={styles.form}>
                  <div className={ui.field}>
                    <label htmlFor={fid('name')} className={ui.label}>
                      Nombre completo
                    </label>
                    <input
                      id={fid('name')}
                      className={ui.input}
                      aria-invalid={Boolean(e?.fullName)}
                      {...register(`attendees.${index}.fullName`)}
                    />
                    {fieldError(e?.fullName?.message)}
                  </div>
                  <div className={ui.row}>
                    <div className={ui.field}>
                      <label htmlFor={fid('kind')} className={ui.label}>
                        Tipo
                      </label>
                      <select
                        id={fid('kind')}
                        className={ui.select}
                        {...register(`attendees.${index}.kind`)}
                      >
                        <option value="adult">Adulto</option>
                        <option value="child">Niño o niña</option>
                      </select>
                    </div>
                    {kind === 'child' && (
                      <div className={ui.field}>
                        <label htmlFor={fid('age')} className={ui.label}>
                          Edad
                        </label>
                        <select
                          id={fid('age')}
                          className={ui.select}
                          aria-invalid={Boolean(e?.age)}
                          {...register(`attendees.${index}.age`, {
                            setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                          })}
                        >
                          <option value="">—</option>
                          {Array.from({ length: 18 }, (_, age) => (
                            <option key={age} value={age}>
                              {age}
                            </option>
                          ))}
                        </select>
                        {fieldError(e?.age?.message)}
                      </div>
                    )}
                    {rules.menuOptions.length > 0 && (
                      <div className={ui.field}>
                        <label htmlFor={fid('menu')} className={ui.label}>
                          Menú
                        </label>
                        <select
                          id={fid('menu')}
                          className={ui.select}
                          aria-invalid={Boolean(e?.menu)}
                          {...register(`attendees.${index}.menu`)}
                        >
                          <option value="">—</option>
                          {rules.menuOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {fieldError(e?.menu?.message)}
                      </div>
                    )}
                  </div>
                  <div className={ui.field}>
                    <label htmlFor={fid('dietary')} className={ui.label}>
                      Alergias o restricciones
                    </label>
                    <input
                      id={fid('dietary')}
                      className={ui.input}
                      {...register(`attendees.${index}.dietary`)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {fieldError(errors.attendees?.message ?? errors.attendees?.root?.message)}
          <Btn
            variant="secondary"
            onClick={() => attendees.append(emptyAttendee())}
            disabled={attendees.fields.length >= invitation.seats}
          >
            Agregar persona ({attendees.fields.length} de {invitation.seats})
          </Btn>

          {rules.questions.parts && (
            <fieldset className={styles.fieldset}>
              <legend className={ui.label}>Asistirán a</legend>
              <label className={ui.checkbox}>
                <input type="checkbox" {...register('parts.ceremony')} />
                {rules.ceremonyTitle}
              </label>
              <label className={ui.checkbox}>
                <input type="checkbox" {...register('parts.reception')} />
                {rules.receptionTitle}
              </label>
              {fieldError(errors.parts?.message)}
            </fieldset>
          )}
          {(rules.questions.transport || rules.questions.lodging) && (
            <div className={ui.row}>
              {rules.questions.transport && (
                <label className={ui.checkbox}>
                  <input
                    type="checkbox"
                    checked={Boolean(needsTransport)}
                    onChange={(e) =>
                      setValue('needsTransport', e.target.checked, { shouldValidate: true })
                    }
                  />
                  Necesitan transporte
                </label>
              )}
              {rules.questions.lodging && (
                <label className={ui.checkbox}>
                  <input
                    type="checkbox"
                    checked={Boolean(needsLodging)}
                    onChange={(e) =>
                      setValue('needsLodging', e.target.checked, { shouldValidate: true })
                    }
                  />
                  Necesitan hospedaje
                </label>
              )}
            </div>
          )}
          {rules.questions.song && (
            <div className={ui.field}>
              <label htmlFor={`${id}-song`} className={ui.label}>
                Canción sugerida
              </label>
              <input id={`${id}-song`} className={ui.input} {...register('songRequest')} />
            </div>
          )}
        </>
      )}

      {status !== 'pending' && (
        <>
          <div className={ui.field}>
            <label htmlFor={`${id}-phone`} className={ui.label}>
              Teléfono de contacto
            </label>
            <input
              id={`${id}-phone`}
              type="tel"
              className={ui.input}
              aria-invalid={Boolean(errors.contactPhone)}
              {...register('contactPhone')}
            />
            {fieldError(errors.contactPhone?.message)}
          </div>
          <div className={ui.field}>
            <label htmlFor={`${id}-message`} className={ui.label}>
              Mensaje para los novios
            </label>
            <textarea id={`${id}-message`} className={ui.textarea} {...register('message')} />
            {fieldError(errors.message?.message)}
          </div>
        </>
      )}

      {status === 'pending' && initial !== 'pending' && (
        <p className={ui.hint}>Al guardar se borra la respuesta y los asistentes.</p>
      )}

      {confirmReset && (
        <ConfirmDialog
          title="¿Dejar la invitación pendiente?"
          message="Se borra la respuesta y la lista de asistentes. El invitado podrá responder de nuevo."
          confirmLabel="Reiniciar respuesta"
          danger
          busy={resetRsvp.isPending}
          onConfirm={reset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </form>
  );
}
