import type { Ref } from 'react';
import styles from './form.module.css';

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={styles.error}>
      {message}
    </p>
  );
}

interface YesNoProps {
  name: string;
  legend: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  onBlur: () => void;
  inputRef: Ref<HTMLInputElement>;
  error?: string;
  errorId: string;
}

/** A yes/no question as two pill-shaped radio buttons (real inputs, styled labels). */
export function YesNo({
  name,
  legend,
  value,
  onChange,
  onBlur,
  inputRef,
  error,
  errorId,
}: YesNoProps) {
  return (
    <fieldset className={styles.fieldset} aria-describedby={error ? errorId : undefined}>
      <legend className={styles.label}>{legend}</legend>
      <div className={styles.segments}>
        {[
          { label: 'Sí', checked: value === true, set: true },
          { label: 'No', checked: value === false, set: false },
        ].map((option, i) => (
          <label key={option.label} className={styles.segment} data-checked={option.checked}>
            <input
              ref={i === 0 ? inputRef : undefined}
              type="radio"
              name={name}
              className="visually-hidden"
              checked={option.checked}
              onChange={() => onChange(option.set)}
              onBlur={onBlur}
              aria-invalid={Boolean(error)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
