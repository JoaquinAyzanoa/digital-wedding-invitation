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

export function ErrorScreen({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  // No (valid) content in the database yet: the couple is still setting it up.
  if (error.code === 'content_invalid') {
    return (
      <div className={styles.screen}>
        <p className={styles.title}>Nuestra invitación estará lista muy pronto.</p>
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
