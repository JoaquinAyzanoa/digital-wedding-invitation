import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { PublicApi } from '@/shared/api';
import { Button } from '@/shared/ui/Button';
import styles from './AlbumUploader.module.css';
import { AlbumUploadQueue, shownProgress, type UploadItem } from './uploadQueue';

function statusText(item: UploadItem) {
  switch (item.status) {
    case 'waiting':
      return 'En espera';
    case 'uploading':
      return 'Subiendo…';
    case 'done':
      return 'Subida ✓';
    case 'error':
      return item.error;
  }
}

/** "3 fotos y 1 video", from what went up. */
function uploadedText(items: UploadItem[]) {
  const count = (kind: UploadItem['kind']) =>
    items.filter((i) => i.kind === kind && i.status === 'done').length;
  const photos = count('photo');
  const videos = count('video');
  const parts = [
    photos ? `${photos} ${photos === 1 ? 'foto' : 'fotos'}` : '',
    videos ? `${videos} ${videos === 1 ? 'video' : 'videos'}` : '',
  ].filter(Boolean);
  return parts.join(' y ') || 'nada';
}

/**
 * "Subir fotos": several at once, from the gallery or the camera, each with its progress.
 * They go at their original quality to the couple's Google Drive.
 */
export function AlbumUploader({ api, uploadUrl }: { api: PublicApi; uploadUrl: string }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [queue] = useState(() => new AlbumUploadQueue(api, uploadUrl));
  const items = useSyncExternalStore(queue.subscribe, queue.getSnapshot);

  const done = items.filter((i) => i.status === 'done').length;
  const failed = items.filter((i) => i.status === 'error').length;
  const retryable = items.filter((i) => i.status === 'error' && i.retryable).length;
  const busy = items.some((i) => i.status === 'waiting' || i.status === 'uploading');

  useEffect(() => () => queue.abort(), [queue]);

  // The estimated bars move on their own: redraw a few times a second while uploading.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [busy]);

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
        accept="image/*,video/*"
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
        {items.length ? 'Subir más' : 'Clic para subir fotos y videos'}
      </Button>

      {items.length > 0 && (
        <>
          <p className={styles.summary} role="status">
            {busy
              ? `Subiendo: ${done} de ${items.length} listos…`
              : failed
                ? `${done} de ${items.length} subidos. ${failed} con problemas.`
                : `¡Gracias! Subiste ${uploadedText(items)}.`}
          </p>
          {busy && <p className={styles.hint}>No cierres esta página hasta que terminen.</p>}
          {retryable > 1 && !busy && (
            <Button variant="outline" onClick={() => queue.retryAll()}>
              Reintentar todas
            </Button>
          )}
          <ul className={styles.list} aria-label="Fotos y videos">
            {items.map((item) => (
              <li key={item.id} className={styles.item} data-status={item.status}>
                <span className={styles.name}>{item.name}</span>
                <span className={styles.state}>{statusText(item)}</span>
                <progress
                  className={styles.bar}
                  max={1}
                  value={shownProgress(item, now)}
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
