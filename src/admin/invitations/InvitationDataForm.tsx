import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { adminErrorMessage, useSaveInvitation } from '@/admin/data/queries';
import ui from '@/admin/ui/ui.module.css';
import {
  emptyInvitationInput,
  invitationInputFromRow,
  invitationInputSchema,
  SIDE_LABELS,
  SIDES,
  type InvitationInput,
  type InvitationRow,
} from '@/shared/schemas/invitationAdmin';
import { useToast } from '@/shared/toast/toastContext';
import styles from './InvitationPanel.module.css';

interface InvitationDataFormProps {
  formId: string;
  invitation?: InvitationRow;
  /** People already confirmed: the passes cannot go below this. */
  confirmedPeople?: number;
  groups: string[];
  onSaved: (row: InvitationRow) => void;
  onBusyChange: (busy: boolean) => void;
  /** Unsaved changes, so the panel can ask before discarding them. */
  onDirtyChange: (dirty: boolean) => void;
}

export function InvitationDataForm({
  formId,
  invitation,
  confirmedPeople = 0,
  groups,
  onSaved,
  onBusyChange,
  onDirtyChange,
}: InvitationDataFormProps) {
  const id = useId();
  const toast = useToast();
  const save = useSaveInvitation();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<InvitationInput>({
    resolver: zodResolver(invitationInputSchema),
    defaultValues: invitation ? invitationInputFromRow(invitation) : emptyInvitationInput(),
  });

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const submit = handleSubmit(async (input) => {
    if (input.seats < confirmedPeople) {
      setError('seats', {
        message: `Hay ${confirmedPeople} personas confirmadas. Quita asistentes en "Respuesta" antes de bajar los pases.`,
      });
      return;
    }
    onBusyChange(true);
    try {
      const row = await save.mutateAsync({ id: invitation?.id, input });
      toast(invitation ? 'Cambios guardados' : `Invitación creada: ${row.code}`);
      reset(input);
      onSaved(row);
    } catch (error) {
      const message = adminErrorMessage(error);
      if ((error as { code?: string }).code === '23505') setError('code', { message });
      else toast(message);
    } finally {
      onBusyChange(false);
    }
  });

  const field = (name: keyof InvitationInput) => ({
    id: `${id}-${name}`,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${id}-${name}-error` : undefined,
  });
  const error = (name: keyof InvitationInput) =>
    errors[name] && (
      <span id={`${id}-${name}-error`} className={ui.error}>
        {errors[name]?.message}
      </span>
    );

  return (
    <form id={formId} className={styles.form} onSubmit={submit} noValidate>
      <div className={ui.field}>
        <label htmlFor={`${id}-displayName`} className={ui.label}>
          Nombre en la invitación
        </label>
        <input
          className={ui.input}
          placeholder="Familia Pérez, Ana y Luis…"
          {...field('displayName')}
          {...register('displayName')}
        />
        {error('displayName')}
      </div>

      <div className={ui.row}>
        <div className={ui.field}>
          <label htmlFor={`${id}-seats`} className={ui.label}>
            Pases
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            className={ui.input}
            {...field('seats')}
            {...register('seats', { valueAsNumber: true })}
          />
          {error('seats')}
        </div>
        <div className={ui.field}>
          <label htmlFor={`${id}-side`} className={ui.label}>
            Lado
          </label>
          <select className={ui.select} {...field('side')} {...register('side')}>
            {SIDES.map((side) => (
              <option key={side} value={side}>
                {SIDE_LABELS[side]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={ui.field}>
        <label htmlFor={`${id}-groupName`} className={ui.label}>
          Grupo <span className={ui.muted}>(opcional)</span>
        </label>
        <input
          className={ui.input}
          list={`${id}-groups`}
          placeholder="Familia, Trabajo, Universidad…"
          {...field('groupName')}
          {...register('groupName')}
        />
        <datalist id={`${id}-groups`}>
          {groups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
        {error('groupName')}
      </div>

      <div className={ui.row}>
        <div className={ui.field}>
          <label htmlFor={`${id}-phone`} className={ui.label}>
            Teléfono
          </label>
          <input
            type="tel"
            inputMode="tel"
            className={ui.input}
            {...field('phone')}
            {...register('phone')}
          />
          {error('phone')}
        </div>
        <div className={ui.field}>
          <label htmlFor={`${id}-email`} className={ui.label}>
            Correo
          </label>
          <input type="email" className={ui.input} {...field('email')} {...register('email')} />
          {error('email')}
        </div>
      </div>

      <div className={ui.field}>
        <label htmlFor={`${id}-notes`} className={ui.label}>
          Notas internas <span className={ui.muted}>(no las ve el invitado)</span>
        </label>
        <textarea className={ui.textarea} {...field('notes')} {...register('notes')} />
        {error('notes')}
      </div>

      <div className={ui.field}>
        <label htmlFor={`${id}-code`} className={ui.label}>
          Código
        </label>
        <input
          className={ui.input}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={invitation ? undefined : 'Vacío = se genera solo'}
          {...field('code')}
          {...register('code')}
        />
        {error('code') ?? (
          <span className={ui.hint}>
            {invitation
              ? 'Si lo cambias, el enlace que ya enviaste deja de funcionar.'
              : '6 caracteres. Déjalo vacío para generarlo automáticamente.'}
          </span>
        )}
      </div>
    </form>
  );
}
