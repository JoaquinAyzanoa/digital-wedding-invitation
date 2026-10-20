import { useId, useState } from 'react';
import { adminErrorMessage, useImportInvitations } from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import { Drawer } from '@/admin/ui/Drawer';
import ui from '@/admin/ui/ui.module.css';
import type { InvitationInput, InvitationRow } from '@/shared/schemas/invitationAdmin';
import { useToast } from '@/shared/toast/toastContext';
import {
  CSV_TEMPLATE,
  downloadText,
  parseInvitationsCsv,
  type ImportResult,
} from '@/shared/utils/csv';
import styles from './ImportDialog.module.css';

const MAX_BYTES = 1_000_000;

interface ImportDialogProps {
  existing: Pick<InvitationRow, 'code' | 'display_name'>[];
  onClose: () => void;
}

export function ImportDialog({ existing, onClose }: ImportDialogProps) {
  const id = useId();
  const toast = useToast();
  const importer = useImportInvitations();
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  async function readFile(file: File | undefined) {
    setResult(null);
    setError('');
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('El archivo es demasiado grande (máximo 1 MB).');
      return;
    }
    setFileName(file.name);
    setResult(parseInvitationsCsv(await file.text(), existing));
  }

  const valid = (result?.rows ?? []).flatMap((row) => (row.input ? [row.input] : []));
  const withErrors = (result?.rows ?? []).filter((row) => row.errors.length);
  const withWarnings = (result?.rows ?? []).filter(
    (row) => !row.errors.length && row.warnings.length,
  );

  async function run(inputs: InvitationInput[]) {
    setError('');
    try {
      const inserted = await importer.mutateAsync(inputs);
      toast(`${inserted} invitaciones importadas`);
      onClose();
    } catch (cause) {
      const inserted = (cause as { inserted?: number }).inserted ?? 0;
      setError(
        `${adminErrorMessage(cause)} ${
          inserted
            ? `Se importaron ${inserted} antes del error; revisa la lista.`
            : 'No se importó nada.'
        }`,
      );
    }
  }

  return (
    <Drawer
      title="Importar invitaciones"
      onClose={onClose}
      footer={
        <Btn onClick={() => run(valid)} disabled={!valid.length || importer.isPending}>
          {importer.isPending
            ? 'Importando…'
            : `Importar ${valid.length} ${valid.length === 1 ? 'invitación' : 'invitaciones'}`}
        </Btn>
      }
    >
      <div className={styles.body}>
        <p className={ui.hint}>
          Un CSV con una fila por invitación. Columnas: <code>nombre</code> (obligatoria),{' '}
          <code>pases</code>, <code>lado</code> (novia, novio o ambos), <code>grupo</code>,{' '}
          <code>telefono</code>, <code>email</code>, <code>notas</code> y <code>codigo</code> (vacío
          = automático). Sirve el que exporta Excel o Google Sheets.
        </p>
        <Btn
          variant="secondary"
          size="sm"
          onClick={() => downloadText('\uFEFF' + CSV_TEMPLATE, 'plantilla-invitaciones.csv')}
        >
          Descargar plantilla
        </Btn>

        <div className={ui.field}>
          <label htmlFor={`${id}-file`} className={ui.label}>
            Archivo
          </label>
          <input
            id={`${id}-file`}
            type="file"
            accept=".csv,text/csv"
            className={ui.input}
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
        </div>

        {error && (
          <p className={ui.errorBox} role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className={styles.result} aria-live="polite">
            {result.fileErrors.map((message) => (
              <p key={message} className={ui.errorBox}>
                {fileName}: {message}
              </p>
            ))}

            {result.rows.length > 0 && (
              <p className={styles.summary}>
                <strong>{result.rows.length}</strong> filas · <strong>{valid.length}</strong> listas
                {withErrors.length > 0 && (
                  <>
                    {' · '}
                    <strong className={styles.bad}>{withErrors.length} con errores</strong> (no se
                    importan)
                  </>
                )}
                {withWarnings.length > 0 && <> · {withWarnings.length} con avisos</>}
              </p>
            )}

            {withErrors.length + withWarnings.length > 0 && (
              <ul className={styles.problems}>
                {[...withErrors, ...withWarnings]
                  .sort((a, b) => a.line - b.line)
                  .map((row) => (
                    <li key={row.line} data-kind={row.errors.length ? 'error' : 'warning'}>
                      <strong>Fila {row.line}</strong>
                      {row.input && <> · {row.input.displayName}</>}
                      <ul>
                        {[...row.errors, ...row.warnings].map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            )}

            {valid.length > 0 && (
              <details>
                <summary>Ver las {valid.length} que se importarán</summary>
                <ul className={styles.preview}>
                  {valid.map((input, i) => (
                    <li key={i}>
                      {input.displayName}{' '}
                      <span className={ui.muted}>
                        · {input.seats} {input.seats === 1 ? 'pase' : 'pases'}
                        {input.groupName && ` · ${input.groupName}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
