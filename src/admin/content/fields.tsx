import { useId, useState, type ReactNode } from 'react';
import {
  Controller,
  get,
  useFieldArray,
  useFormContext,
  type ArrayPath,
  type FieldPath,
} from 'react-hook-form';
import { adminErrorMessage } from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import ui from '@/admin/ui/ui.module.css';
import { UiIcon } from '@/shared/icons/UiIcon';
import type { ContentForm } from './form';
import styles from './fields.module.css';

type Path = FieldPath<ContentForm>;

function useFieldError(name: string): string | undefined {
  const {
    formState: { errors },
  } = useFormContext<ContentForm>();
  return get(errors, name)?.message as string | undefined;
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span id={id} className={ui.error}>
      {message}
    </span>
  ) : null;
}

interface TextFieldProps {
  name: Path;
  label: string;
  hint?: string;
  multiline?: boolean;
  placeholder?: string;
  /** Empty means "not set" (undefined): optional URLs and texts. */
  emptyAsUndefined?: boolean;
  type?: 'text' | 'url' | 'date' | 'time';
}

export function TextField({
  name,
  label,
  hint,
  multiline,
  placeholder,
  emptyAsUndefined,
  type = 'text',
}: TextFieldProps) {
  const id = useId();
  const { register, control } = useFormContext<ContentForm>();
  const error = useFieldError(name);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const common = {
    id,
    placeholder,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
  };

  // Optional fields hold `undefined` when empty. They are controlled: an uncontrolled input
  // would read '' from the page on mount and the form would look changed right away.
  const input = emptyAsUndefined ? (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const props = {
          ...common,
          ref: field.ref,
          name: field.name,
          value: typeof field.value === 'string' ? field.value : '',
          onBlur: field.onBlur,
          onChange: (e: { target: { value: string } }) =>
            field.onChange(e.target.value === '' ? undefined : e.target.value),
        };
        return multiline ? (
          <textarea className={ui.textarea} {...props} />
        ) : (
          <input type={type} className={ui.input} {...props} />
        );
      }}
    />
  ) : multiline ? (
    <textarea className={ui.textarea} {...common} {...register(name)} />
  ) : (
    <input type={type} className={ui.input} {...common} {...register(name)} />
  );

  return (
    <div className={ui.field}>
      <label htmlFor={id} className={ui.label}>
        {label}
      </label>
      {input}
      {error ? (
        <ErrorText id={`${id}-error`} message={error} />
      ) : (
        hint && (
          <span id={`${id}-hint`} className={ui.hint}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

export function Toggle({ name, label, hint }: { name: Path; label: string; hint?: string }) {
  const { register } = useFormContext<ContentForm>();
  return (
    <div className={ui.field}>
      <label className={ui.checkbox}>
        <input type="checkbox" {...register(name)} />
        {label}
      </label>
      {hint && <span className={ui.hint}>{hint}</span>}
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  emptyLabel,
}: {
  name: Path;
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
  /** Adds an empty option meaning "not set" (undefined). */
  emptyLabel?: string;
}) {
  const id = useId();
  const { control } = useFormContext<ContentForm>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={ui.field}>
          <label htmlFor={id} className={ui.label}>
            {label}
          </label>
          <select
            id={id}
            ref={field.ref}
            name={field.name}
            className={ui.select}
            aria-invalid={Boolean(error)}
            value={typeof field.value === 'string' ? field.value : ''}
            onBlur={field.onBlur}
            onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
          >
            {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
            {options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          <ErrorText id={`${id}-error`} message={error} />
        </div>
      )}
    />
  );
}

/** Bare date (YYYY-MM-DD, read in Lima) even if the stored value was a full datetime. */
export function DateField({ name, label, hint }: { name: Path; label: string; hint?: string }) {
  const id = useId();
  const { control } = useFormContext<ContentForm>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={ui.field}>
          <label htmlFor={id} className={ui.label}>
            {label}
          </label>
          <input
            id={id}
            type="date"
            className={ui.input}
            value={typeof field.value === 'string' ? field.value.slice(0, 10) : ''}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
            aria-invalid={Boolean(error)}
          />
          {error ? (
            <ErrorText id={`${id}-error`} message={error} />
          ) : (
            hint && <span className={ui.hint}>{hint}</span>
          )}
        </div>
      )}
    />
  );
}

/** The wedding's date and time, always stored with Lima's offset (UTC−5, no DST). */
export function WeddingDateTimeField({ name, label }: { name: Path; label: string }) {
  const id = useId();
  const { control } = useFormContext<ContentForm>();
  const error = useFieldError(name);
  const toLocal = (iso: unknown) => {
    if (typeof iso !== 'string' || !iso) return '';
    const date = new Date(new Date(iso).getTime() - 5 * 3_600_000);
    return date.toISOString().slice(0, 16);
  };
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={ui.field}>
          <label htmlFor={id} className={ui.label}>
            {label}
          </label>
          <input
            id={id}
            type="datetime-local"
            className={ui.input}
            value={toLocal(field.value)}
            onChange={(e) => field.onChange(e.target.value ? `${e.target.value}:00-05:00` : '')}
            onBlur={field.onBlur}
            ref={field.ref}
            aria-invalid={Boolean(error)}
          />
          {error ? (
            <ErrorText id={`${id}-error`} message={error} />
          ) : (
            <span className={ui.hint}>Hora de Lima.</span>
          )}
        </div>
      )}
    />
  );
}

function MoveButtons({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className={styles.itemActions}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label={`Subir ${label}`}
      >
        ↑
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => onMove(index, index + 1)}
        disabled={index === count - 1}
        aria-label={`Bajar ${label}`}
      >
        ↓
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onRemove}
        aria-label={`Quitar ${label}`}
      >
        <UiIcon name="close" size={16} />
      </button>
    </div>
  );
}

/** A list of plain strings (names, notes, menu options), reorderable. */
export function StringListField({
  name,
  label,
  addLabel,
  placeholder,
}: {
  name: Path;
  label: string;
  addLabel: string;
  placeholder?: string;
}) {
  const id = useId();
  const { control } = useFormContext<ContentForm>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const items = (Array.isArray(field.value) ? field.value : []) as string[];
        const set = (next: string[]) => field.onChange(next);
        const itemErrors = fieldState.error as unknown as Array<{ message?: string }> | undefined;
        return (
          <fieldset className={styles.fieldset}>
            <legend className={ui.label}>{label}</legend>
            {items.map((item, index) => (
              <div key={index} className={styles.stringItem}>
                <input
                  className={ui.input}
                  value={item}
                  placeholder={placeholder}
                  aria-label={`${label} ${index + 1}`}
                  aria-invalid={Boolean(itemErrors?.[index])}
                  onChange={(e) => set(items.map((v, i) => (i === index ? e.target.value : v)))}
                  onBlur={field.onBlur}
                />
                <MoveButtons
                  index={index}
                  count={items.length}
                  label={`${label} ${index + 1}`}
                  onMove={(from, to) => {
                    const next = [...items];
                    next.splice(to, 0, next.splice(from, 1)[0]!);
                    set(next);
                  }}
                  onRemove={() => set(items.filter((_, i) => i !== index))}
                />
              </div>
            ))}
            <ErrorText
              id={`${id}-error`}
              message={error ?? itemErrors?.find((e) => e?.message)?.message}
            />
            <Btn size="sm" variant="secondary" onClick={() => set([...items, ''])}>
              {addLabel}
            </Btn>
          </fieldset>
        );
      }}
    />
  );
}

/** A list of objects (events, itinerary, gifts, sections): `render` draws one item. */
const HEX = /^#[0-9a-f]{6}$/i;

/** A short list of colors: a swatch to pick each one and its code, e.g. colors to avoid. */
export function ColorListField({
  name,
  label,
  hint,
  addLabel,
  max,
}: {
  name: Path;
  label: string;
  hint?: string;
  addLabel: string;
  max: number;
}) {
  const id = useId();
  const { control } = useFormContext<ContentForm>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const items = (Array.isArray(field.value) ? field.value : []) as string[];
        const set = (next: string[]) => field.onChange(next);
        const update = (index: number, value: string) =>
          set(items.map((v, i) => (i === index ? value : v)));
        const itemErrors = fieldState.error as unknown as Array<{ message?: string }> | undefined;
        return (
          <fieldset className={styles.fieldset} aria-describedby={hint ? `${id}-hint` : undefined}>
            <legend className={ui.label}>{label}</legend>
            {hint && (
              <span id={`${id}-hint`} className={ui.hint}>
                {hint}
              </span>
            )}
            {items.map((item, index) => (
              <div key={index} className={styles.stringItem}>
                <input
                  type="color"
                  className={styles.colorSwatch}
                  value={HEX.test(item) ? item : '#000000'}
                  onChange={(e) => update(index, e.target.value.toUpperCase())}
                  aria-label={`${label} ${index + 1}: elegir color`}
                />
                <input
                  className={ui.input}
                  value={item}
                  aria-label={`${label} ${index + 1}`}
                  aria-invalid={Boolean(itemErrors?.[index])}
                  spellCheck={false}
                  onChange={(e) => update(index, e.target.value)}
                  onBlur={field.onBlur}
                />
                <MoveButtons
                  index={index}
                  count={items.length}
                  label={`${label} ${index + 1}`}
                  onMove={(from, to) => {
                    const next = [...items];
                    next.splice(to, 0, next.splice(from, 1)[0]!);
                    set(next);
                  }}
                  onRemove={() => set(items.filter((_, i) => i !== index))}
                />
              </div>
            ))}
            <ErrorText
              id={`${id}-error`}
              message={error ?? itemErrors?.find((e) => e?.message)?.message}
            />
            {items.length < max && (
              <Btn size="sm" variant="secondary" onClick={() => set([...items, '#FFFFFF'])}>
                {addLabel}
              </Btn>
            )}
          </fieldset>
        );
      }}
    />
  );
}

export function ObjectListField<N extends ArrayPath<ContentForm>>({
  name,
  label,
  itemLabel,
  addLabel,
  newItem,
  render,
}: {
  name: N;
  label: string;
  itemLabel: (index: number) => string;
  addLabel: string;
  newItem: () => unknown;
  render: (index: number) => ReactNode;
}) {
  const { control } = useFormContext<ContentForm>();
  const list = useFieldArray({ control, name });
  const error = useFieldError(name);
  return (
    <fieldset className={styles.fieldset}>
      <legend className={ui.label}>{label}</legend>
      {list.fields.map((item, index) => (
        <div key={item.id} className={styles.objectItem}>
          <div className={styles.objectHeader}>
            <strong>{itemLabel(index)}</strong>
            <MoveButtons
              index={index}
              count={list.fields.length}
              label={itemLabel(index)}
              onMove={list.move}
              onRemove={() => list.remove(index)}
            />
          </div>
          <div className={styles.objectBody}>{render(index)}</div>
        </div>
      ))}
      {error && <span className={ui.error}>{error}</span>}
      <Btn
        size="sm"
        variant="secondary"
        onClick={() => list.append(newItem() as Parameters<typeof list.append>[0])}
      >
        {addLabel}
      </Btn>
    </fieldset>
  );
}

/** Upload with a preview; `upload` returns the public URL to store. */
export function UploadField({
  name,
  label,
  accept,
  hint,
  upload,
  kind,
  clearTo = undefined,
}: {
  name: Path;
  label: string;
  accept: string;
  hint?: string;
  upload: (file: File) => Promise<string>;
  kind: 'image' | 'audio' | 'video';
  /** What "Quitar" stores: null for photo slots, undefined for optional fields. */
  clearTo?: null | undefined;
}) {
  const id = useId();
  const { control } = useFormContext<ContentForm>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const url = typeof field.value === 'string' ? field.value : '';
        async function choose(file: File | undefined) {
          if (!file) return;
          setBusy(true);
          setError('');
          try {
            field.onChange(await upload(file));
          } catch (cause) {
            setError(adminErrorMessage(cause));
          } finally {
            setBusy(false);
          }
        }
        return (
          <div className={ui.field}>
            <span className={ui.label}>{label}</span>
            <div className={styles.upload}>
              {url &&
                (kind === 'image' ? (
                  <img src={url} alt="" className={styles.thumb} />
                ) : kind === 'video' ? (
                  <video
                    src={url}
                    className={styles.videoThumb}
                    muted
                    loop
                    autoPlay
                    playsInline
                    aria-label="Vista previa del video"
                  />
                ) : (
                  <audio src={url} controls preload="none" className={styles.audio} />
                ))}
              <div className={styles.uploadActions}>
                <label className={styles.fileButton} htmlFor={id} aria-disabled={busy}>
                  {busy ? 'Subiendo…' : url ? 'Cambiar' : 'Subir'}
                </label>
                <input
                  id={id}
                  type="file"
                  accept={accept}
                  aria-label={`${label}: ${url ? 'cambiar' : 'subir'} archivo`}
                  className="visually-hidden"
                  disabled={busy}
                  onChange={(e) => {
                    void choose(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                {url && !busy && (
                  <Btn size="sm" variant="ghost" onClick={() => field.onChange(clearTo)}>
                    Quitar
                  </Btn>
                )}
              </div>
            </div>
            {error ? (
              <span className={ui.error} role="alert">
                {error}
              </span>
            ) : (
              hint && <span className={ui.hint}>{hint}</span>
            )}
          </div>
        );
      }}
    />
  );
}
