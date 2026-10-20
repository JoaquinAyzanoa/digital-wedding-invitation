import { useEffect, useState } from 'react';
import { signedUrls, type AlbumPhoto } from '@/admin/data/album';
import { adminErrorMessage } from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import { Modal } from '@/admin/ui/Modal';
import ui from '@/admin/ui/ui.module.css';
import { downloadBlob } from '@/shared/utils/download';
import styles from './AlbumZipDialog.module.css';
import { photoZipName, zipParts } from './names';

type State =
  | { kind: 'working'; part: number; done: number }
  | { kind: 'ready'; part: number; blob: Blob }
  | { kind: 'finished' }
  | { kind: 'error'; message: string };

interface AlbumZipDialogProps {
  /** Frozen when the dialog opens: changes in the album meanwhile do not restart it. */
  photos: AlbumPhoto[];
  onClose: () => void;
}

/**
 * The photos as ZIP files of ~100 MB (a phone cannot hold the whole album in memory). One
 * part downloads by itself; with several, each one waits for a tap on "Guardar" (phones
 * block downloads that do not follow a tap) and only then the next one is prepared.
 */
export function AlbumZipDialog({ photos, onClose }: AlbumZipDialogProps) {
  const [parts] = useState(() => zipParts(photos));
  const [state, setState] = useState<State>({ kind: 'working', part: 0, done: 0 });
  const part = state.kind === 'working' ? state.part : null;

  useEffect(() => {
    if (part === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const items = parts[part]!;
        for (let i = 0; i < items.length; i += 50) {
          const batch = items.slice(i, i + 50);
          const urls = await signedUrls(batch.map((p) => p.path));
          for (const photo of batch) {
            if (cancelled) return;
            const url = urls.get(photo.path);
            if (url) {
              const response = await fetch(url);
              if (!response.ok)
                throw new Error(`No se pudo descargar una foto (${response.status}).`);
              // Photos are already compressed: stored as they are, which is much faster.
              zip.file(photoZipName(photo), await response.blob(), { compression: 'STORE' });
            }
            const done =
              parts.slice(0, part).reduce((n, p) => n + p.length, 0) + i + batch.indexOf(photo) + 1;
            setState({ kind: 'working', part, done });
          }
        }
        if (cancelled) return;
        const blob = await zip.generateAsync({ type: 'blob' });
        if (cancelled) return;
        if (parts.length === 1) {
          downloadBlob(blob, zipName(0, 1));
          setState({ kind: 'finished' });
        } else {
          setState({ kind: 'ready', part, blob });
        }
      } catch (error) {
        if (!cancelled) setState({ kind: 'error', message: adminErrorMessage(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [part, parts]);

  function save() {
    if (state.kind !== 'ready') return;
    downloadBlob(state.blob, zipName(state.part, parts.length));
    const next = state.part + 1;
    setState(
      next < parts.length
        ? {
            kind: 'working',
            part: next,
            done: parts.slice(0, next).reduce((n, p) => n + p.length, 0),
          }
        : { kind: 'finished' },
    );
  }

  const total = photos.length;
  const working = state.kind === 'working' || state.kind === 'ready';

  return (
    <Modal
      title="Descargar fotos"
      onClose={onClose}
      actions={
        <Btn variant={working ? 'secondary' : 'primary'} onClick={onClose}>
          {working ? 'Cancelar' : 'Cerrar'}
        </Btn>
      }
    >
      {state.kind === 'error' ? (
        <p className={ui.errorBox} role="alert">
          {state.message}
        </p>
      ) : state.kind === 'finished' ? (
        <p role="status">
          Listo: {total} {total === 1 ? 'foto' : 'fotos'}
          {parts.length > 1 ? ` en ${parts.length} archivos ZIP.` : ' en el ZIP.'}
        </p>
      ) : (
        <>
          <p role="status">
            {state.kind === 'ready'
              ? `Parte ${state.part + 1} de ${parts.length} lista.`
              : `Preparando ${Math.min(state.done + 1, total)} de ${total}…`}
          </p>
          <progress
            className={styles.progress}
            max={total}
            value={
              state.kind === 'working'
                ? state.done
                : parts.slice(0, state.part + 1).reduce((n, p) => n + p.length, 0)
            }
          />
          {parts.length > 1 && (
            <p className={ui.hint}>
              Son {parts.length} archivos de hasta 100 MB, para que el celular no se quede sin
              memoria.
            </p>
          )}
          {state.kind === 'ready' && (
            <Btn onClick={save}>
              Guardar parte {state.part + 1} de {parts.length}
            </Btn>
          )}
        </>
      )}
    </Modal>
  );
}

function zipName(part: number, parts: number) {
  const date = new Date().toISOString().slice(0, 10);
  return parts === 1 ? `album-${date}.zip` : `album-${date}-parte-${part + 1}-de-${parts}.zip`;
}
