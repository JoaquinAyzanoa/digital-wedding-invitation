import { useState } from 'react';
import { Link } from 'react-router';
import { useSiteContent } from '@/admin/data/content';
import { adminErrorMessage, useRotateSheetSecret, useSheetSettings } from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import { ConfirmDialog } from '@/admin/ui/ConfirmDialog';
import ui from '@/admin/ui/ui.module.css';
import { useToast } from '@/shared/toast/toastContext';
import { copyText } from '@/shared/utils/clipboard';
import { siteUrl } from '@/shared/utils/links';
import styles from './SettingsPage.module.css';

/** The script runs every 10 minutes: older than this means it stopped. */
const STALE_MINUTES = 25;

function minutesSince(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
}

function SyncStatus({ lastSyncAt }: { lastSyncAt: string | null }) {
  if (!lastSyncAt) {
    return (
      <p className={styles.status} data-tone="off">
        Hoja: aún no se sincroniza. Sigue los pasos de abajo.
      </p>
    );
  }
  const minutes = minutesSince(lastSyncAt);
  const date = new Date(lastSyncAt).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return minutes <= STALE_MINUTES ? (
    <p className={styles.status} data-tone="ok">
      Hoja funcionando · última sincronización hace{' '}
      {minutes <= 1 ? '1 minuto' : `${minutes} minutos`}
    </p>
  ) : (
    <p className={styles.status} data-tone="warn">
      Hoja sin sincronizar desde el {date}. Revisa el activador del script (o si cambiaste el
      secreto).
    </p>
  );
}

/** The album is connected when the content has the web app's URL. */
function AlbumStatus() {
  const content = useSiteContent();
  const album = content.data?.public.album;
  if (!album) return null;
  if (!album.uploadUrl) {
    return (
      <p className={styles.status} data-tone="off">
        Álbum sin conectar: los invitados todavía no ven el botón para subir fotos (pasos 5 a 8).
      </p>
    );
  }
  return (
    <p className={styles.status} data-tone="ok">
      Álbum conectado: las fotos van a tu carpeta de Google Drive.
      {album.folderUrl && (
        <>
          {' '}
          <a href={album.folderUrl} target="_blank" rel="noopener noreferrer">
            Abrir carpeta
          </a>
        </>
      )}
    </p>
  );
}

function CopyValue({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const toast = useToast();
  const [shown, setShown] = useState(!secret);
  return (
    <div className={styles.value}>
      <span className={ui.label}>{label}</span>
      <code className={styles.code}>{shown ? value : '•'.repeat(12)}</code>
      <span className={styles.valueActions}>
        {secret && (
          <Btn size="sm" variant="ghost" onClick={() => setShown(!shown)}>
            {shown ? 'Ocultar' : 'Mostrar'}
          </Btn>
        )}
        <Btn
          size="sm"
          variant="secondary"
          aria-label={`Copiar ${label}`}
          onClick={async () => toast((await copyText(value)) ? 'Copiado' : 'No se pudo copiar')}
        >
          Copiar
        </Btn>
      </span>
    </div>
  );
}

export function SettingsPage() {
  const toast = useToast();
  const settings = useSheetSettings();
  const rotate = useRotateSheetSecret();
  const [confirmRotate, setConfirmRotate] = useState(false);

  async function copyScript() {
    // Loaded on demand: the admin only needs it once, when setting up the Sheet.
    const { default: code } = await import('../../../apps-script/Code.js?raw');
    toast((await copyText(code)) ? 'Código del script copiado' : 'No se pudo copiar');
  }

  async function rotateSecret() {
    try {
      await rotate.mutateAsync();
      toast('Secreto cambiado: actualiza SECRET en el script de la hoja');
    } catch (error) {
      toast(adminErrorMessage(error));
    } finally {
      setConfirmRotate(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Ajustes</h1>

      <section className={ui.card}>
        <h2 className={ui.cardTitle}>Google: hoja y álbum de fotos</h2>
        <p className={ui.hint}>
          El mismo código de Google sirve para dos cosas, que pueden estar en cuentas distintas:
          copiar invitaciones, asistentes y un resumen a una hoja de Google cada 10 minutos (solo
          lectura: los cambios se hacen aquí), y recibir las fotos de los invitados en una carpeta
          de Google Drive, en su calidad original.
        </p>

        {settings.isPending && <p className={ui.muted}>Cargando…</p>}
        {settings.isError && (
          <p className={ui.errorBox} role="alert">
            {adminErrorMessage(settings.error)}
          </p>
        )}
        {settings.data && (
          <>
            <SyncStatus lastSyncAt={settings.data.lastSyncAt} />
            <AlbumStatus />

            <h3 className={styles.subtitle}>
              1. La hoja (en la cuenta de Google donde la quieres)
            </h3>
            <ol className={styles.steps}>
              <li>
                Crea una hoja nueva en{' '}
                <a href="https://sheets.new" target="_blank" rel="noopener noreferrer">
                  Google Sheets
                </a>{' '}
                y abre <strong>Extensiones → Apps Script</strong>.
              </li>
              <li>
                Borra lo que haya en <code>Code.gs</code> y pega el código del script.{' '}
                <Btn size="sm" variant="secondary" onClick={copyScript}>
                  Copiar código del script
                </Btn>
              </li>
              <li>
                En <strong>Configuración del proyecto → Propiedades del script</strong>, agrega
                estas cuatro:
                <div className={styles.values}>
                  <CopyValue label="SUPABASE_URL" value={import.meta.env.VITE_SUPABASE_URL ?? ''} />
                  <CopyValue
                    label="SUPABASE_KEY"
                    value={import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''}
                  />
                  <CopyValue label="SECRET" value={settings.data.secret} secret />
                  <CopyValue label="SITE_URL" value={siteUrl()} />
                </div>
              </li>
              <li>
                Elige la función <code>setup</code> y pulsa <strong>Ejecutar</strong>. Acepta los
                permisos (es tu propio script). Crea las hojas y un activador cada 10 minutos.
              </li>
            </ol>

            <h3 className={styles.subtitle}>
              2. El álbum (en la cuenta de Google cuyo Drive guarda las fotos)
            </h3>
            <ol className={styles.steps} start={5}>
              <li>
                Con esa cuenta, abre{' '}
                <a
                  href="https://script.google.com/home/projects/create"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  script.google.com → Nuevo proyecto
                </a>{' '}
                y pega el mismo código.{' '}
                <Btn size="sm" variant="secondary" onClick={copyScript}>
                  Copiar código del script
                </Btn>
              </li>
              <li>
                En sus <strong>Propiedades del script</strong> agrega solo una:{' '}
                <code>FOLDER_ID</code>, con el enlace de tu carpeta de Drive (ábrela en Drive y
                copia la dirección del navegador:{' '}
                <code>https://drive.google.com/drive/folders/…</code>
                ). No necesita los datos de la hoja.
              </li>
              <li>
                Elige la función <code>setupAlbum</code> y pulsa <strong>Ejecutar</strong>. Acepta
                los permisos de Drive. En el registro verás el nombre de tu carpeta.
              </li>
              <li>
                <strong>Implementar → Nueva implementación</strong>, tipo{' '}
                <strong>Aplicación web</strong>, «Ejecutar como»: <strong>Yo</strong>, «Quién tiene
                acceso»: <strong>Cualquier usuario</strong>. Copia la URL de la aplicación web y
                pégala en <Link to="/content">Contenido → Álbum y despedida</Link>, pulsa «Probar
                conexión» y guarda.
              </li>
            </ol>
            <p className={ui.hint}>
              Listo: los dos estados de arriba pasan a verde. Si un script falla, Google le avisa
              por correo a la cuenta dueña. Si más adelante cambias el código del álbum, usa{' '}
              <strong>Implementar → Gestionar implementaciones → Editar → Versión nueva</strong>:
              así la URL no cambia.
            </p>

            <h3 className={styles.subtitle}>Secreto</h3>
            <p className={ui.hint}>
              Con el secreto, cualquiera puede leer la lista de invitados. Si crees que alguien lo
              vio, cámbialo y actualiza <code>SECRET</code> en el script de la hoja.
            </p>
            <Btn variant="secondary" onClick={() => setConfirmRotate(true)}>
              Cambiar secreto
            </Btn>
          </>
        )}
      </section>

      {confirmRotate && (
        <ConfirmDialog
          title="¿Cambiar el secreto?"
          message="La hoja deja de actualizarse hasta que pegues el nuevo SECRET en su script."
          confirmLabel="Cambiar"
          danger
          busy={rotate.isPending}
          onConfirm={rotateSecret}
          onCancel={() => setConfirmRotate(false)}
        />
      )}
    </div>
  );
}
