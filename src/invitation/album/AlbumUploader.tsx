import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { PublicApi } from '@/shared/api';
import { Button } from '@/shared/ui/Button';
import styles from './AlbumUploader.module.css';
import { AlbumUploadQueue, type UploadItem } from './uploadQueue';

const prepare = async (file: File) => (await import('./compress')).preparePhoto(file);

function statusText(item: UploadItem) {
  switch (item.status) {
    case 'waiting':
      return 'En espera';
    case 'preparing':
      return 'Preparando…';
    case 'uploading':
      return `Subiendo ${Math.round(item.progress * 100)} %`;
    case 'done':
      return 'Subida ✓';
    case 'error':
      return item.error;
  }
}

/** "Subir fotos": several at once, from the gallery or the camera, each with its progress. */
export function AlbumUploader({ api, code }: { api: PublicApi; code: string }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [queue] = useState(() => new AlbumUploadQueue(api, code, prepare));
  const items = useSyncExternalStore(queue.subscribe, queue.getSnapshot);

  const done = items.filter((i) => i.status === 'done').length;
  const failed = items.filter((i) => i.status === 'error').length;
  const retryable = items.filter((i) => i.status === 'error' && i.retryable).length;
  const busy = items.some((i) => i.status !== 'done' && i.status !== 'error');

  useEffect(() => () => queue.abort(), [queue]);

  // Leaving mid-upload loses the photos still going up: ask first.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  return (
    <div className={styles.uploader}>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length) queue.add(files);
          event.target.value = '';
        }}
      />
      <Button onClick={() => input.current?.click()}>
        {items.length ? 'Subir más fotos' : 'Clic para subir fotos'}
      </Button>

      {items.length > 0 && (
        <>
          <p className={styles.summary} role="status">
            {busy
              ? `Subiendo fotos: ${done} de ${items.length} listas…`
              : failed
                ? `${done} de ${items.length} fotos subidas. ${failed} con problemas.`
                : `¡Gracias! ${done === 1 ? 'Subiste 1 foto' : `Subiste ${done} fotos`}.`}
          </p>
          {busy && <p className={styles.hint}>No cierres esta página hasta que terminen.</p>}
          {retryable > 1 && !busy && (
            <Button variant="outline" onClick={() => queue.retryAll()}>
              Reintentar todas
            </Button>
          )}
          <ul className={styles.list} aria-label="Fotos">
            {items.map((item) => (
              <li key={item.id} className={styles.item} data-status={item.status}>
                <span className={styles.name}>{item.name}</span>
                <span className={styles.state}>{statusText(item)}</span>
                <progress
                  className={styles.bar}
                  max={1}
                  value={item.status === 'done' ? 1 : item.progress}
                  aria-label={`${item.name}: ${statusText(item)}`}
                />
                {item.status === 'error' && item.retryable && (
                  <button
                    type="button"
                    className={styles.retry}
                    onClick={() => queue.retry(item.id)}
                  >
                    Reintentar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
