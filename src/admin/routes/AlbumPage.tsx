import { Link } from 'react-router';
import { useAlbumSummary } from '@/admin/data/album';
import { adminErrorMessage, useSheetSettings } from '@/admin/data/queries';
import { Btn, BtnLink } from '@/admin/ui/Btn';
import ui from '@/admin/ui/ui.module.css';
import styles from './AlbumPage.module.css';

function size(bytes: number) {
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function when(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** The album lives in Google Drive: here, what arrived and the way to the folder. */
export function AlbumPage() {
  const summary = useAlbumSummary();
  const google = useSheetSettings();
  const folderUrl = google.data?.albumFolderUrl;
  const connected = Boolean(google.data?.albumUploadUrl);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Álbum {summary.data && <span className={ui.muted}>({summary.data.photos})</span>}
        </h1>
        {folderUrl && (
          <BtnLink href={folderUrl} target="_blank" rel="noopener noreferrer">
            Abrir en Google Drive
          </BtnLink>
        )}
      </div>

      <section className={ui.card}>
        <p>
          Las fotos llegan en su calidad original a la carpeta «Fotos de la boda» de tu Google
          Drive, en una subcarpeta por invitado. Allí puedes verlas, borrarlas o descargar todo.
        </p>
        {google.data && !connected && (
          <p className={styles.notice}>
            El álbum aún no está conectado: los invitados no ven el botón para subir fotos.{' '}
            <Link to="/settings">Conéctalo en Ajustes</Link>.
          </p>
        )}
        <p className={ui.hint}>
          Abrir o cerrar el álbum, sus fechas y el texto: en{' '}
          <Link to="/content">Contenido → Álbum y despedida</Link>.
        </p>
      </section>

      {summary.isPending && <p className={ui.empty}>Cargando…</p>}
      {summary.isError && (
        <div className={ui.empty} role="alert">
          <p>{adminErrorMessage(summary.error)}</p>
          <Btn variant="secondary" onClick={() => summary.refetch()}>
            Reintentar
          </Btn>
        </div>
      )}
      {summary.data &&
        (summary.data.photos === 0 ? (
          <p className={ui.empty}>Todavía no hay fotos. Aquí verás cuántas sube cada invitado.</p>
        ) : (
          <section className={ui.card}>
            <h2 className={ui.cardTitle}>
              {summary.data.photos} {summary.data.photos === 1 ? 'foto' : 'fotos'} de{' '}
              {summary.data.guests.length}{' '}
              {summary.data.guests.length === 1 ? 'invitado' : 'invitados'} ·{' '}
              {size(summary.data.bytes)}
            </h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Invitado</th>
                  <th scope="col">Fotos</th>
                  <th scope="col">Última</th>
                </tr>
              </thead>
              <tbody>
                {summary.data.guests.map((guest) => (
                  <tr key={guest.code}>
                    <th scope="row">{guest.name}</th>
                    <td>{guest.photos}</td>
                    <td>{when(guest.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={ui.hint}>
              Cuenta las fotos recibidas; si borras alguna en Drive, aquí no se descuenta.
            </p>
          </section>
        ))}
    </div>
  );
}
