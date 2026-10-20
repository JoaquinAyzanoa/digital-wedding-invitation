import { useState } from 'react';
import { adminErrorMessage, useRotateSheetSecret, useSheetSettings } from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import { ConfirmDialog } from '@/admin/ui/ConfirmDialog';
import ui from '@/admin/ui/ui.module.css';
import { useToast } from '@/shared/toast/toastContext';
import { copyText } from '@/shared/utils/clipboard';
import { siteUrl } from '@/shared/utils/links';
import styles from './SettingsPage.module.css';

/** The script runs every 5 minutes: older than this means it stopped. */
const STALE_MINUTES = 15;

function minutesSince(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
}

function SyncStatus({ lastSyncAt }: { lastSyncAt: string | null }) {
  if (!lastSyncAt) {
    return (
      <p className={styles.status} data-tone="off">
        Aún no se sincroniza. Sigue los pasos de abajo.
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
      Funcionando · última sincronización hace {minutes <= 1 ? '1 minuto' : `${minutes} minutos`}
    </p>
  ) : (
    <p className={styles.status} data-tone="warn">
      Sin sincronizar desde el {date}. Revisa el activador del script (o si cambiaste el secreto).
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
      toast('Secreto cambiado: actualiza SECRET en el script');
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
        <h2 className={ui.cardTitle}>Google Sheet</h2>
        <p className={ui.hint}>
          Una copia de solo lectura de invitaciones, asistentes y un resumen, en una hoja de Google
          que se actualiza cada 5 minutos. Los cambios se hacen aquí, no en la hoja.
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

            <h3 className={styles.subtitle}>Cómo conectarla (una sola vez)</h3>
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
                En el editor, elige la función <code>setup</code> y pulsa <strong>Ejecutar</strong>.
                Acepta los permisos que pide Google (es tu propio script). Crea las hojas y un
                activador cada 5 minutos.
              </li>
              <li>
                Listo: este estado pasa a «Funcionando». Si el script falla, Google te avisa por
                correo.
              </li>
            </ol>

            <h3 className={styles.subtitle}>Secreto</h3>
            <p className={ui.hint}>
              Con el secreto, cualquiera puede leer la lista de invitados. Si crees que alguien lo
              vio, cámbialo y actualiza <code>SECRET</code> en el script.
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
          message="La hoja deja de actualizarse hasta que pegues el nuevo SECRET en el script."
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
