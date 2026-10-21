import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useSiteContent } from '@/admin/data/content';
import { Btn, BtnLink } from '@/admin/ui/Btn';
import ui from '@/admin/ui/ui.module.css';
import { useToast } from '@/shared/toast/toastContext';
import { isAlbumOpen } from '@/shared/utils/album';
import { copyText } from '@/shared/utils/clipboard';
import { downloadBlob } from '@/shared/utils/download';
import { photosPageUrl } from '@/shared/utils/links';
import styles from './AlbumPage.module.css';

/** A big QR (to print), dark on white, generated in the browser. */
function useQrImage(url: string) {
  return useQuery({
    queryKey: ['album', 'qr', url],
    staleTime: Infinity,
    queryFn: async () => {
      const { default: QRCode } = await import('qrcode');
      return QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: 'M' });
    },
  });
}

/** The album lives in Google Drive: here, the way to the folder and the QR for the tables. */
export function AlbumPage() {
  const toast = useToast();
  const content = useSiteContent();
  const album = content.data?.public.album;
  const url = photosPageUrl();
  const qr = useQrImage(url);

  async function downloadQr() {
    if (!qr.data) return;
    downloadBlob(await (await fetch(qr.data)).blob(), 'qr-fotos-boda.png');
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Álbum</h1>
        {album?.folderUrl && (
          <BtnLink href={album.folderUrl} target="_blank" rel="noopener noreferrer">
            Abrir en Google Drive
          </BtnLink>
        )}
      </div>

      <section className={ui.card}>
        <p>
          Las fotos y videos llegan en su calidad original a tu carpeta de Google Drive, apenas el
          invitado los sube. Allí puedes verlos, borrarlos o descargar todo.
        </p>
        {album && !album.uploadUrl && (
          <p className={styles.notice}>
            El álbum aún no está conectado: nadie ve el botón para subir fotos.{' '}
            <Link to="/settings">Conéctalo en Ajustes</Link>.
          </p>
        )}
        {album?.uploadUrl && !isAlbumOpen(album) && (
          <p className={styles.notice}>
            Conectado, pero cerrado por ahora: revisa «Álbum de fotos activo» y las fechas en{' '}
            <Link to="/content">Contenido → Álbum y despedida</Link>.
          </p>
        )}
      </section>

      <section className={ui.card}>
        <h2 className={ui.cardTitle}>QR para las mesas</h2>
        <p className={ui.hint}>
          Abre una página donde cualquiera sube sus fotos y videos, sin código. Imprímelo en las
          mesas o en un cartel.
        </p>
        <div className={styles.qrBox}>
          {qr.data ? (
            <img className={styles.qr} src={qr.data} alt={`Código QR de ${url}`} />
          ) : (
            <span className={styles.qr} aria-hidden="true" />
          )}
          <div className={styles.qrActions}>
            <code className={styles.url}>{url.replace(/^https?:\/\//, '')}</code>
            <Btn onClick={downloadQr} disabled={!qr.data}>
              Descargar QR (PNG)
            </Btn>
            <Btn
              variant="secondary"
              onClick={async () =>
                toast((await copyText(url)) ? 'Enlace copiado' : 'No se pudo copiar')
              }
            >
              Copiar enlace
            </Btn>
            <BtnLink variant="secondary" href={url} target="_blank" rel="noopener noreferrer">
              Abrir la página
            </BtnLink>
          </div>
        </div>
      </section>
    </div>
  );
}
