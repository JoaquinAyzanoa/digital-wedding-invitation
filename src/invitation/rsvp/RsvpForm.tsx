import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Controller,
  FormProvider,
  get,
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
  type Resolver,
} from 'react-hook-form';
import { useRsvpContext } from '@/invitation/rsvpContext';
import { ApiError } from '@/shared/api';
import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import {
  emptyAttendee,
  rsvpDefaults,
  rsvpFormSchema,
  toRsvpInput,
  type RsvpFormValues,
} from '@/shared/schemas/rsvp';
import { Button } from '@/shared/ui/Button';
import { AttendeeCard } from './AttendeeCard';
import { FieldError, YesNo } from './fields';
import styles from './form.module.css';

type Step = 'attending' | 'details' | 'message';

// Fields validated before leaving each step (the last step submits everything).
const STEP_FIELDS: Record<Exclude<Step, 'message'>, FieldPath<RsvpFormValues>[]> = {
  attending: ['attending'],
  details: ['attendees', 'parts', 'needsTransport', 'needsLodging', 'songRequest', 'contactPhone'],
};

const MESSAGE_MAX = 1000;

interface RsvpFormProps {
  content: PublicContent;
  invitation: InvitationView;
  /** Called after a successful answer (with whether they are coming) or when it closed. */
  onDone: (attending: boolean | null) => void;
  /** Present when changing an existing answer: go back to the summary. */
  onCancel?: () => void;
  /** Focus the first question on mount (the button that opened the form is gone). */
  autoFocus?: boolean;
}

export function RsvpForm({ content, invitation, onDone, onCancel, autoFocus }: RsvpFormProps) {
  const { api, onInvitationChange } = useRsvpContext();
  const { menuOptions, questions } = content.rsvp;
  const seats = invitation.seats;
  const plural = seats > 1;
  const idPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const schema = useMemo(
    () => rsvpFormSchema({ seats, menuOptions, questions }),
    [seats, menuOptions, questions],
  );
  const form = useForm<RsvpFormValues>({
    // The schema's input is a union with literal `attending`; the form holds the looser shape.
    resolver: zodResolver(schema) as unknown as Resolver<RsvpFormValues>,
    defaultValues: rsvpDefaults(invitation),
    mode: 'onTouched',
  });
  const {
    register,
    control,
    trigger,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = form;
  const attendees = useFieldArray({ control, name: 'attendees' });
  const attending = useWatch({ control, name: 'attending' });
  const message = useWatch({ control, name: 'message' });

  // Steps are validated with trigger(), not submit, so react-hook-form would only re-check a
  // field on blur: messages stayed after fixing them (a chosen menu never blurs) and the
  // layout jumped mid-tap when they finally cleared. Re-validate any shown error on change,
  // including errors on a parent (e.g. `parts` when a checkbox changes).
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ name }) => {
          if (!name) return;
          const segments = name.split('.');
          for (let i = segments.length; i > 0; i--) {
            const path = segments.slice(0, i).join('.') as FieldPath<RsvpFormValues>;
            if (get(form.formState.errors, path)) {
              void form.trigger(path);
              return;
            }
          }
        },
      }),
    [form],
  );

  const [step, setStep] = useState<Step>('attending');
  // While one step animates out and the next in, ignore taps (a quick double tap on
  // "Continuar" would otherwise validate fields that are not on screen yet).
  const [transitioning, setTransitioning] = useState(false);
  const [status, setStatus] = useState('');
  const [serverError, setServerError] = useState('');
  // Steps animate out before the next one mounts: focus each new question as it appears
  // (not on first render) so keyboards and screen readers follow along.
  const focusNextHeading = useRef(Boolean(autoFocus));
  const headingRef = useCallback((element: HTMLLegendElement | null) => {
    if (element && focusNextHeading.current) {
      focusNextHeading.current = false;
      element.focus();
    }
  }, []);

  const steps: Step[] =
    attending === false ? ['attending', 'message'] : ['attending', 'details', 'message'];
  const stepIndex = steps.indexOf(step);

  function goTo(target: Step) {
    focusNextHeading.current = true;
    setTransitioning(true);
    setStep(target);
  }

  async function next() {
    if (step === 'message' || transitioning) return;
    setStatus('');
    const ok = await trigger(STEP_FIELDS[step], { shouldFocus: true });
    if (!ok) {
      setStatus('Revisa los campos marcados.');
      return;
    }
    goTo(steps[stepIndex + 1]!);
  }

  function back() {
    if (transitioning) return;
    setStatus('');
    if (stepIndex === 0) {
      onCancel?.();
      return;
    }
    goTo(steps[stepIndex - 1]!);
  }

  const submit = handleSubmit(
    async () => {
      setServerError('');
      const values = getValues();
      try {
        const view = await api.submitRsvp(invitation.code, toRsvpInput(values, questions));
        onInvitationChange(view);
        onDone(values.attending);
      } catch (error) {
        const code = error instanceof ApiError ? error.code : 'unknown';
        if (code === 'rsvp_closed') {
          onInvitationChange({ ...invitation, rsvpOpen: false });
          onDone(null);
          return;
        }
        setServerError(
          code === 'invalid_attendees' || code === 'invalid_payload'
            ? 'Algunos datos no son válidos. Revísalos e inténtalo de nuevo.'
            : code === 'rate_limited'
              ? 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
              : 'No pudimos enviar tu respuesta. Revisa tu conexión e inténtalo de nuevo.',
        );
      }
    },
    () => setStatus('Revisa los campos marcados.'),
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Enter while sending would submit again (the disabled button does not stop it).
    if (isSubmitting) return;
    // Enter on an earlier step means "continue", not "send".
    if (step === 'message') void submit();
    else void next();
  }

  const ceremony = content.events.find((e) => e.kind === 'ceremony');
  const reception = content.events.find((e) => e.kind === 'reception');
  const err = (name: string) => `${idPrefix}-${name}-error`;

  return (
    <FormProvider {...form}>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <p className={styles.progress}>
          Paso {stepIndex + 1} de {steps.length}
        </p>

        <AnimatePresence mode="wait" initial={false} onExitComplete={() => setTransitioning(false)}>
          <motion.div
            key={step}
            className={styles.step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 'attending' && (
              <Controller
                control={control}
                name="attending"
                render={({ field }) => (
                  <fieldset
                    className={styles.fieldset}
                    aria-describedby={errors.attending ? err('attending') : undefined}
                  >
                    <legend ref={headingRef} tabIndex={-1} className={styles.question}>
                      {plural ? '¿Nos acompañan?' : '¿Nos acompañas?'}
                    </legend>
                    <div className={styles.choices}>
                      {[
                        { value: true, label: plural ? 'Sí, asistiremos' : 'Sí, asistiré' },
                        {
                          value: false,
                          label: plural ? 'No podremos asistir' : 'No podré asistir',
                        },
                      ].map((option, i) => (
                        <label
                          key={option.label}
                          className={styles.choice}
                          data-checked={field.value === option.value}
                        >
                          <input
                            ref={i === 0 ? field.ref : undefined}
                            type="radio"
                            name={field.name}
                            className="visually-hidden"
                            checked={field.value === option.value}
                            onChange={() => field.onChange(option.value)}
                            onBlur={field.onBlur}
                            aria-invalid={Boolean(errors.attending)}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                    <FieldError id={err('attending')} message={errors.attending?.message} />
                  </fieldset>
                )}
              />
            )}

            {step === 'details' && (
              <fieldset className={styles.fieldset}>
                <legend ref={headingRef} tabIndex={-1} className={styles.question}>
                  {plural ? '¿Quiénes vienen?' : 'Tus datos'}
                </legend>
                {plural && (
                  <p className={styles.hint}>
                    Hemos reservado {seats} lugares en su honor. Agrega a cada persona que asistirá.
                  </p>
                )}

                {attendees.fields.map((field, index) => (
                  <AttendeeCard
                    key={field.id}
                    index={index}
                    idPrefix={idPrefix}
                    menuOptions={menuOptions}
                    onRemove={
                      attendees.fields.length > 1 ? () => attendees.remove(index) : undefined
                    }
                  />
                ))}
                <FieldError
                  id={err('attendees')}
                  message={errors.attendees?.message ?? errors.attendees?.root?.message}
                />
                {plural && (
                  <Button
                    variant="outline"
                    className={styles.add}
                    onClick={() => attendees.append(emptyAttendee())}
                    disabled={attendees.fields.length >= seats}
                  >
                    Agregar persona ({attendees.fields.length} de {seats})
                  </Button>
                )}

                {questions.parts && (
                  <fieldset
                    className={styles.fieldset}
                    aria-describedby={errors.parts ? err('parts') : undefined}
                  >
                    <legend className={styles.label}>¿A qué parte del día asistirán?</legend>
                    <label className={styles.checkbox}>
                      <input type="checkbox" {...register('parts.ceremony')} />
                      {ceremony?.title ?? 'Ceremonia'}
                    </label>
                    <label className={styles.checkbox}>
                      <input type="checkbox" {...register('parts.reception')} />
                      {reception?.title ?? 'Recepción'}
                    </label>
                    <FieldError id={err('parts')} message={errors.parts?.message} />
                  </fieldset>
                )}

                {questions.transport && (
                  <Controller
                    control={control}
                    name="needsTransport"
                    render={({ field }) => (
                      <YesNo
                        name={field.name}
                        legend={plural ? '¿Necesitan transporte?' : '¿Necesitas transporte?'}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        error={errors.needsTransport?.message}
                        errorId={err('transport')}
                      />
                    )}
                  />
                )}

                {questions.lodging && (
                  <Controller
                    control={control}
                    name="needsLodging"
                    render={({ field }) => (
                      <YesNo
                        name={field.name}
                        legend={plural ? '¿Necesitan hospedaje?' : '¿Necesitas hospedaje?'}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        error={errors.needsLodging?.message}
                        errorId={err('lodging')}
                      />
                    )}
                  />
                )}

                {questions.song && (
                  <div className={styles.field}>
                    <label htmlFor={`${idPrefix}-song`} className={styles.label}>
                      ¿Qué canción no puede faltar?{' '}
                      <span className={styles.optional}>(opcional)</span>
                    </label>
                    <input
                      id={`${idPrefix}-song`}
                      className={styles.input}
                      aria-invalid={Boolean(errors.songRequest)}
                      aria-describedby={errors.songRequest ? err('song') : undefined}
                      {...register('songRequest')}
                    />
                    <FieldError id={err('song')} message={errors.songRequest?.message} />
                  </div>
                )}

                <div className={styles.field}>
                  <label htmlFor={`${idPrefix}-phone`} className={styles.label}>
                    Teléfono de contacto <span className={styles.optional}>(opcional)</span>
                  </label>
                  <input
                    id={`${idPrefix}-phone`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={styles.input}
                    aria-invalid={Boolean(errors.contactPhone)}
                    aria-describedby={errors.contactPhone ? err('phone') : undefined}
                    {...register('contactPhone')}
                  />
                  <FieldError id={err('phone')} message={errors.contactPhone?.message} />
                </div>
              </fieldset>
            )}

            {step === 'message' && (
              <fieldset className={styles.fieldset}>
                <legend ref={headingRef} tabIndex={-1} className={styles.question}>
                  {attending ? 'Un mensaje para los novios' : 'Gracias por avisarnos'}
                </legend>
                {!attending && (
                  <p className={styles.hint}>Si quieres, déjales unas palabras a los novios.</p>
                )}
                <div className={styles.field}>
                  <label htmlFor={`${idPrefix}-message`} className={styles.label}>
                    Tu mensaje <span className={styles.optional}>(opcional)</span>
                  </label>
                  <textarea
                    id={`${idPrefix}-message`}
                    className={styles.textarea}
                    maxLength={MESSAGE_MAX}
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={`${idPrefix}-message-count${errors.message ? ` ${err('message')}` : ''}`}
                    {...register('message')}
                  />
                  <span id={`${idPrefix}-message-count`} className={styles.counter}>
                    {message.length} / {MESSAGE_MAX}
                  </span>
                  <FieldError id={err('message')} message={errors.message?.message} />
                </div>
              </fieldset>
            )}
          </motion.div>
        </AnimatePresence>

        <p className="visually-hidden" aria-live="polite">
          {status}
        </p>
        {serverError && (
          <p className={styles.alert} role="alert">
            {serverError}
          </p>
        )}

        <div className={styles.actions}>
          {(stepIndex > 0 || onCancel) && (
            <button type="button" className={styles.linkButton} onClick={back}>
              {stepIndex === 0 ? 'Cancelar' : 'Atrás'}
            </button>
          )}
          <Button type="submit" disabled={isSubmitting || transitioning}>
            {step === 'message' ? (isSubmitting ? 'Enviando…' : 'Enviar respuesta') : 'Continuar'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
