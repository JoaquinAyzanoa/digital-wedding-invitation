import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { photoUrl, useDeletePhotos, useSetPhotoHidden, type AlbumPhoto } from '@/admin/data/album';
import { adminErrorMessage } from '@/admin/data/queries';
import { Btn, BtnLink } from '@/admin/ui/Btn';
import { ConfirmDialog } from '@/admin/ui/ConfirmDialog';
import { Modal } from '@/admin/ui/Modal';
import ui from '@/admin/ui/ui.module.css';
import { useToast } from '@/shared/toast/toastContext';
import { photoFileName } from './names';
import styles from './PhotoViewer.module.css';

interface PhotoViewerProps {
  photos: AlbumPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** One photo at full size, with the previous / next ones and the moderation actions. */
export function PhotoViewer({ photos, index, onIndexChange, onClose }: PhotoViewerProps) {
  const toast = useToast();
  const photo = photos[index]!;
  const setHidden = useSetPhotoHidden();
  const remove = useDeletePhotos();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const urls = useQuery({
    queryKey: ['album', 'full', photo.path],
    staleTime: 50 * 60 * 1000,
    queryFn: async () => ({
      view: await photoUrl(photo.path),
      download: await photoUrl(photo.path, photoFileName(photo)),
    }),
  });

  const date = new Date(photo.created_at).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  async function toggleHidden() {
    try {
      await setHidden.mutateAsync({ id: photo.id, hidden: !photo.hidden });
      toast(photo.hidden ? 'La foto vuelve a las descargas' : 'Foto oculta');
    } catch (error) {
      toast(adminErrorMessage(error));
    }
  }

  async function deletePhoto() {
    try {
      await remove.mutateAsync([photo]);
      toast('Foto eliminada');
      setConfirmDelete(false);
      // The list shrinks: stay at the same position (the next photo), or close at the end.
      if (photos.length <= 1) onClose();
      else if (index >= photos.length - 1) onIndexChange(index - 1);
    } catch (error) {
      toast(adminErrorMessage(error));
      setConfirmDelete(false);
    }
  }

  return (
    <Modal
      title={`${photo.invitation.display_name} · ${date}`}
      onClose={onClose}
      actions={
        <>
          {urls.data ? (
            <BtnLink variant="secondary" href={urls.data.download}>
              Descargar
            </BtnLink>
          ) : (
            <Btn variant="secondary" disabled>
              Descargar
            </Btn>
          )}
          <Btn onClick={onClose}>Cerrar</Btn>
        </>
      }
    >
      <div
        className={styles.viewer}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
          if (event.key === 'ArrowRight' && index < photos.length - 1) onIndexChange(index + 1);
        }}
      >
        {urls.isError && <p className={ui.errorBox}>{adminErrorMessage(urls.error)}</p>}
        {urls.data ? (
          <img
            className={styles.photo}
            src={urls.data.view}
            alt={`Foto de ${photo.invitation.display_name}`}
            data-hidden={photo.hidden}
          />
        ) : (
          !urls.isError && <p className={ui.muted}>Cargando…</p>
        )}
        {photo.hidden && <p className={ui.hint}>Oculta: no entra en «Descargar todo».</p>}
        <div className={styles.tools}>
          <Btn size="sm" variant="secondary" onClick={toggleHidden} disabled={setHidden.isPending}>
            {photo.hidden ? 'Mostrar' : 'Ocultar'}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            className={styles.delete}
            onClick={() => setConfirmDelete(true)}
          >
            Eliminar
          </Btn>
        </div>
        <div className={styles.nav}>
          <Btn
            size="sm"
            variant="ghost"
            disabled={index === 0}
            onClick={() => onIndexChange(index - 1)}
          >
            ‹ Anterior
          </Btn>
          <span className={ui.muted}>
            {index + 1} de {photos.length}
          </span>
          <Btn
            size="sm"
            variant="ghost"
            disabled={index >= photos.length - 1}
            onClick={() => onIndexChange(index + 1)}
          >
            Siguiente ›
          </Btn>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar esta foto?"
          message="Se borra del álbum para siempre. Si solo no quieres descargarla, mejor ocúltala."
          confirmLabel="Eliminar"
          danger
          busy={remove.isPending}
          onConfirm={deletePhoto}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}
