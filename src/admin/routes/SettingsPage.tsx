import { useId, useState } from 'react';
import {
  adminErrorMessage,
  useRotateSheetSecret,
  useSetAlbumUploadUrl,
  useSheetSettings,
  type SheetSettings,
} from '@/admin/data/queries';
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

function AlbumStatus({ settings }: { settings: SheetSettings }) {
  if (!settings.albumUploadUrl) {
    return (
      <p className={styles.status} data-tone="off">
        Álbum sin conectar: los invitados todavía no ven el botón para subir fotos (pasos 5 a 8).
      </p>
    );
  }
  return (
    <p className={styles.status} data-tone="ok">
      Álbum conectado: las fotos van a tu Google Drive.
      {settings.albumFolderUrl && (
        <>
          {' '}
          <a href={settings.albumFolderUrl} target="_blank" rel="noopener noreferrer">
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

const WEB_APP_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

/** Step 5: the web app that receives the album photos, and a quick check that it answers. */
function AlbumConnection({ settings }: { settings: SheetSettings }) {
  const id = useId();
  const toast = useToast();
  const save = useSetAlbumUploadUrl();
  const [url, setUrl] = useState(settings.albumUploadUrl ?? '');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  async function submit() {
    const value = url.trim();
    if (value && !WEB_APP_URL.test(value)) {
      setError('Pega la URL de la aplicación web: https://script.google.com/macros/s/…/exec');
      return;
    }
    setError('');
    try {
      await save.mutateAsync(value || null);
      toast(value ? 'Álbum conectado' : 'Álbum desconectado');
    } catch (cause) {
      toast(adminErrorMessage(cause));
    }
  }

  async function test() {
    setTesting(true);
    try {
      const reply = (await (await fetch(settings.albumUploadUrl!)).json()) as { ok?: boolean };
      toast(reply.ok ? 'Conexión correcta: el script responde' : 'El script no respondió bien');
    } catch {
      toast('No se pudo conectar. ¿El acceso es «Cualquier usuario»?');
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <div className={ui.field}>
        <label htmlFor={id} className={ui.label}>
          URL de la aplicación web
        </label>
        <input
          id={id}
          className={ui.input}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/…/exec"
          spellCheck={false}
          aria-invalid={Boolean(error)}
        />
        {error && <span className={ui.error}>{error}</span>}
      </div>
      <div className={styles.valueActions}>
        <Btn size="sm" onClick={submit} disabled={save.isPending}>
          Guardar
        </Btn>
        {settings.albumUploadUrl && (
          <Btn size="sm" variant="secondary" onClick={test} disabled={testing}>
            {testing ? 'Probando…' : 'Probar conexión'}
          </Btn>
        )}
      </div>
    </>
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
      toast('Secreto cambiado: actualiza SECRET en los scripts');
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
          Un solo script de Google hace dos cosas: copia invitaciones, asistentes y un resumen a una
          hoja de Google cada 10 minutos (solo lectura: los cambios se hacen aquí), y recibe las
          fotos de los invitados en una carpeta de tu Google Drive, en su calidad original.
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
            <AlbumStatus settings={settings.data} />

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
              2. El álbum (en la cuenta de Google cuyo Drive guardará las fotos)
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
                En sus <strong>Propiedades del script</strong> agrega las mismas{' '}
                <code>SUPABASE_URL</code>, <code>SUPABASE_KEY</code> y <code>SECRET</code> del paso
                3.
              </li>
              <li>
                Elige la función <code>setupAlbum</code> y pulsa <strong>Ejecutar</strong>. Acepta
                los permisos: crea la carpeta «Fotos de la boda» en el Drive de esa cuenta.
              </li>
              <li>
                <strong>Implementar → Nueva implementación</strong>, tipo{' '}
                <strong>Aplicación web</strong>, «Ejecutar como»: <strong>Yo</strong>, «Quién tiene
                acceso»: <strong>Cualquier usuario</strong>. Pulsa Implementar, copia la URL de la
                aplicación web y pégala aquí:
                <AlbumConnection settings={settings.data} />
              </li>
            </ol>
            <p className={ui.hint}>
              Listo: los dos estados de arriba pasan a verde. Si un script falla, Google le avisa
              por correo a la cuenta dueña. ¿Todo en una sola cuenta? Haz los pasos 7 y 8 en el
              mismo script de la hoja. Si más adelante cambias el código del álbum, usa{' '}
              <strong>Implementar → Gestionar implementaciones → Editar → Versión nueva</strong>:
              así la URL no cambia.
            </p>

            <h3 className={styles.subtitle}>Secreto</h3>
            <p className={ui.hint}>
              Con el secreto, cualquiera puede leer la lista de invitados. Si crees que alguien lo
              vio, cámbialo y actualiza <code>SECRET</code> en los dos scripts (hoja y álbum).
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
          message="La hoja y el álbum dejan de funcionar hasta que pegues el nuevo SECRET en los dos scripts."
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
