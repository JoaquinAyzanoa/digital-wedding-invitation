import type { ApiError } from '@/shared/api';
import { Button } from '@/shared/ui/Button';
import styles from './StatusScreen.module.css';

export function LoadingScreen() {
  return (
    <div className={styles.screen} role="status" aria-label="Cargando la invitación">
      <span className={styles.dots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

/** Last resort when something fails while rendering: never leave a blank page. */
export function CrashScreen() {
  return (
    <div className={styles.screen} role="alert">
      <p className={styles.title}>Algo salió mal al mostrar la invitación.</p>
      <p className={styles.text}>Recarga la página para intentarlo de nuevo.</p>
      <Button onClick={() => window.location.reload()}>Recargar</Button>
    </div>
  );
}

export function ErrorScreen({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  // No (valid) content in the database yet: the couple is still setting it up.
  if (error.code === 'content_invalid') {
    return (
      <div className={styles.screen}>
        <p className={styles.title}>Nuestra invitación estará lista muy pronto.</p>
      </div>
    );
  }

  if (error.code === 'rate_limited') {
    return (
      <div className={styles.screen} role="alert">
        <p className={styles.title}>Demasiados intentos con códigos que no existen.</p>
        <p className={styles.text}>Espera unos minutos y vuelve a abrir tu enlace.</p>
      </div>
    );
  }

  return (
    <div className={styles.screen} role="alert">
      <p className={styles.title}>No pudimos cargar la invitación.</p>
      <p className={styles.text}>Revisa tu conexión a internet e inténtalo de nuevo.</p>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  );
}
