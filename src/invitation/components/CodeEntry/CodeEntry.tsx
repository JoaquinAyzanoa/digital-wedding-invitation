import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { isWellFormedCode, normalizeCode } from '@/shared/utils/code';
import styles from './CodeEntry.module.css';

/** Asks for the code at the end of the guest's link and reloads with `?<code>`. */
export function CodeEntry({ message }: { message: string }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const id = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    const code = normalizeCode(value);
    if (!code || !isWellFormedCode(code)) {
      setError('El código tiene 4 letras o números. Lo encuentras al final de tu enlace.');
      return;
    }
    const url = new URL(window.location.href);
    url.search = `?${code}`;
    window.location.assign(url);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor={`${id}-code`} className={styles.label}>
        {message}
      </label>
      <input
        id={`${id}-code`}
        className={styles.input}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError('');
        }}
        maxLength={6}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="p. ej. k7m2qp"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit">Ver mi invitación</Button>
    </form>
  );
}
