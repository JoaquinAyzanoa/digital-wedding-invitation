import { useFormContext, useWatch } from 'react-hook-form';
import type { RsvpFormValues } from '@/shared/schemas/rsvp';
import { FieldError } from './fields';
import styles from './form.module.css';

interface AttendeeCardProps {
  index: number;
  idPrefix: string;
  menuOptions: string[];
  onRemove?: () => void;
}

const AGES = Array.from({ length: 18 }, (_, age) => age);

export function AttendeeCard({ index, idPrefix, menuOptions, onRemove }: AttendeeCardProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<RsvpFormValues>();
  const kind = useWatch({ control, name: `attendees.${index}.kind` });
  const fieldErrors = errors.attendees?.[index];
  const id = (field: string) => `${idPrefix}-a${index}-${field}`;
  const describedBy = (field: string, error?: unknown) =>
    error ? id(`${field}-error`) : undefined;

  return (
    <div className={styles.card} role="group" aria-labelledby={id('title')}>
      <div className={styles.cardHeader}>
        <h4 id={id('title')} className={styles.cardTitle}>
          Persona {index + 1}
        </h4>
        {onRemove && (
          <button type="button" className={styles.linkButton} onClick={onRemove}>
            Quitar<span className="visually-hidden"> a la persona {index + 1}</span>
          </button>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={id('name')} className={styles.label}>
          Nombre completo
        </label>
        <input
          id={id('name')}
          className={styles.input}
          autoComplete={index === 0 ? 'name' : 'off'}
          aria-invalid={Boolean(fieldErrors?.fullName)}
          aria-describedby={describedBy('name', fieldErrors?.fullName)}
          {...register(`attendees.${index}.fullName`)}
        />
        <FieldError id={id('name-error')} message={fieldErrors?.fullName?.message} />
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>¿Adulto o niño?</legend>
        <div className={styles.segments}>
          {(
            [
              ['adult', 'Adulto'],
              ['child', 'Niño o niña'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={styles.segment} data-checked={kind === value}>
              <input
                type="radio"
                value={value}
                className="visually-hidden"
                {...register(`attendees.${index}.kind`)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {kind === 'child' && (
        <div className={styles.field}>
          <label htmlFor={id('age')} className={styles.label}>
            Edad
          </label>
          <select
            id={id('age')}
            className={styles.select}
            aria-invalid={Boolean(fieldErrors?.age)}
            aria-describedby={describedBy('age', fieldErrors?.age)}
            {...register(`attendees.${index}.age`, {
              setValueAs: (value) => (value === '' || value === null ? null : Number(value)),
            })}
          >
            <option value="">Elige la edad</option>
            {AGES.map((age) => (
              <option key={age} value={age}>
                {age === 0 ? 'Menos de 1 año' : `${age} ${age === 1 ? 'año' : 'años'}`}
              </option>
            ))}
          </select>
          <FieldError id={id('age-error')} message={fieldErrors?.age?.message} />
        </div>
      )}

      {menuOptions.length > 0 && (
        <div className={styles.field}>
          <label htmlFor={id('menu')} className={styles.label}>
            Menú
          </label>
          <select
            id={id('menu')}
            className={styles.select}
            aria-invalid={Boolean(fieldErrors?.menu)}
            aria-describedby={describedBy('menu', fieldErrors?.menu)}
            {...register(`attendees.${index}.menu`)}
          >
            <option value="">Elige un menú</option>
            {menuOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <FieldError id={id('menu-error')} message={fieldErrors?.menu?.message} />
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor={id('dietary')} className={styles.label}>
          Alergias o restricciones <span className={styles.optional}>(opcional)</span>
        </label>
        <input
          id={id('dietary')}
          className={styles.input}
          placeholder="p. ej. alergia al maní"
          aria-invalid={Boolean(fieldErrors?.dietary)}
          aria-describedby={describedBy('dietary', fieldErrors?.dietary)}
          {...register(`attendees.${index}.dietary`)}
        />
        <FieldError id={id('dietary-error')} message={fieldErrors?.dietary?.message} />
      </div>
    </div>
  );
}
