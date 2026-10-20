import { useEffect, useId, useMemo, useState } from 'react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { ContentEditor } from '@/admin/content/ContentEditor';
import type { ContentForm } from '@/admin/content/form';
import { adminErrorMessage } from '@/admin/data/queries';
import { uploadFont } from '@/admin/data/storage';
import { Btn } from '@/admin/ui/Btn';
import ui from '@/admin/ui/ui.module.css';
import type { CustomFont, FontRef, ThemeColor } from '@/shared/schemas/content';
import { contrastRatio, MIN_TEXT_CONTRAST } from '@/shared/theme/contrast';
import { CURATED_FONTS, fontStack, loadFonts, type FontRole } from '@/shared/theme/fonts';
import { DEFAULT_THEME } from '@/shared/theme/theme';
import styles from './ThemePage.module.css';

const COLOR_LABELS: Record<ThemeColor, [string, string]> = {
  bg: ['Fondo', 'Fondo de toda la invitación'],
  surface: ['Tarjetas', 'Tarjeta de regalos'],
  ink: ['Texto', 'Texto principal y títulos'],
  muted: ['Texto secundario', 'Notas y ayudas'],
  primary: ['Principal', 'Botones, nombres, sobre'],
  accent: ['Acento', 'Íconos dorados, líneas y sello'],
  line: ['Líneas', 'Bordes suaves'],
};

const ROLE_LABELS: Record<FontRole, [string, string]> = {
  script: ['Caligrafía', 'Nombres y títulos'],
  serif: ['Serif', 'Textos'],
  sans: ['Sans', 'Detalles y botones pequeños'],
};

const refKey = (ref: FontRef) =>
  ref.source === 'google' ? `google:${ref.family}` : `custom:${ref.id}`;

function parseRefKey(key: string): FontRef {
  const [source, value = ''] = key.split(/:(.*)/s);
  return source === 'custom'
    ? { source: 'custom', id: value }
    : { source: 'google', family: value };
}

/** Lowercase slug for a custom font id ("Mi Caligrafía" → "mi-caligrafia-x7k2"). */
function fontId(family: string): string {
  const slug = family
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return `${slug || 'fuente'}-${Math.random().toString(36).slice(2, 6)}`;
}

function ColorField({ token }: { token: ThemeColor }) {
  const id = useId();
  const { control } = useFormContext<ContentForm>();
  const [label, hint] = COLOR_LABELS[token];
  return (
    <Controller
      control={control}
      name={`public.theme.colors.${token}`}
      render={({ field, fieldState }) => (
        <div className={styles.color}>
          <input
            type="color"
            className={styles.swatch}
            value={/^#[0-9a-f]{6}$/i.test(field.value) ? field.value : '#000000'}
            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
            aria-label={`${label}: elegir color`}
          />
          <div className={ui.field}>
            <label htmlFor={id} className={ui.label}>
              {label}
            </label>
            <input
              id={id}
              className={ui.input}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              aria-invalid={Boolean(fieldState.error)}
              spellCheck={false}
            />
            <span className={fieldState.error ? ui.error : ui.hint}>
              {fieldState.error?.message ?? hint}
            </span>
          </div>
        </div>
      )}
    />
  );
}

function ContrastWarnings() {
  const { control } = useFormContext<ContentForm>();
  const colors = useWatch({ control, name: 'public.theme.colors' });
  const pairs: Array<[ThemeColor, ThemeColor, string]> = [
    ['ink', 'bg', 'El texto sobre el fondo'],
    ['primary', 'bg', 'Los nombres y botones sobre el fondo'],
    ['ink', 'surface', 'El texto sobre las tarjetas'],
  ];
  const valid = (hex: string | undefined) => /^#[0-9a-f]{6}$/i.test(hex ?? '');
  const low = pairs.filter(
    ([a, b]) =>
      valid(colors?.[a]) &&
      valid(colors?.[b]) &&
      contrastRatio(colors[a]!, colors[b]!) < MIN_TEXT_CONTRAST,
  );
  if (!low.length) return null;
  return (
    <ul className={styles.warnings} role="status">
      {low.map(([, , text]) => (
        <li key={text}>{text} se lee con dificultad (poco contraste).</li>
      ))}
    </ul>
  );
}

function FontField({ role, sample }: { role: FontRole; sample: string }) {
  const id = useId();
  const { control } = useFormContext<ContentForm>();
  const customFonts = useWatch({ control, name: 'public.customFonts' }) ?? [];
  const [label, hint] = ROLE_LABELS[role];
  return (
    <Controller
      control={control}
      name={`public.theme.fonts.${role}`}
      render={({ field }) => (
        <div className={styles.font}>
          <div className={ui.field}>
            <label htmlFor={id} className={ui.label}>
              {label} <span className={ui.muted}>· {hint}</span>
            </label>
            <select
              id={id}
              className={ui.select}
              value={field.value ? refKey(field.value) : ''}
              onChange={(e) => field.onChange(parseRefKey(e.target.value))}
            >
              <optgroup label="Google Fonts">
                {CURATED_FONTS[role].map((font) => (
                  <option key={font.family} value={`google:${font.family}`}>
                    {font.family}
                  </option>
                ))}
              </optgroup>
              {customFonts.length > 0 && (
                <optgroup label="Fuentes propias">
                  {customFonts.map((font) => (
                    <option key={font.id} value={`custom:${font.id}`}>
                      {font.family}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          {field.value && (
            <p
              className={styles.sample}
              data-role={role}
              style={{ fontFamily: fontStack(field.value, role) }}
            >
              {sample}
            </p>
          )}
        </div>
      )}
    />
  );
}

function CustomFonts() {
  const id = useId();
  const { control, getValues } = useFormContext<ContentForm>();
  const list = useFieldArray({ control, name: 'public.customFonts', keyName: 'key' });
  const [family, setFamily] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!/\.(ttf|otf)$/i.test(file.name)) {
      setError('Sube un archivo .ttf u .otf.');
      return;
    }
    const name = family.trim() || file.name.replace(/\.(ttf|otf)$/i, '');
    setBusy(true);
    try {
      const url = await uploadFont(file);
      const font: CustomFont = { id: fontId(name), family: name.slice(0, 60), url };
      list.append(font);
      setFamily('');
    } catch (cause) {
      setError(adminErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function inUse(fontIdToCheck: string) {
    return Object.values(getValues('public.theme.fonts')).some(
      (ref) => ref.source === 'custom' && ref.id === fontIdToCheck,
    );
  }

  return (
    <div className={ui.card}>
      <h2 className={ui.cardTitle}>Fuentes propias</h2>
      <p className={ui.hint}>
        Para usar una caligrafía que no está en Google Fonts (por ejemplo una comprada). Asegúrate
        de que su licencia permita usarla en una web. TTF u OTF, hasta 2 MB.
      </p>
      {list.fields.length > 0 && (
        <ul className={styles.customList}>
          {list.fields.map((font, index) => (
            <li key={font.key}>
              <span style={{ fontFamily: fontStack({ source: 'custom', id: font.id }, 'script') }}>
                {font.family}
              </span>
              <Btn
                size="sm"
                variant="ghost"
                disabled={inUse(font.id)}
                title={
                  inUse(font.id) ? 'Está en uso: elige otra fuente antes de quitarla' : undefined
                }
                onClick={() => list.remove(index)}
              >
                Quitar
              </Btn>
            </li>
          ))}
        </ul>
      )}
      <div className={ui.row}>
        <div className={ui.field}>
          <label htmlFor={`${id}-family`} className={ui.label}>
            Nombre de la fuente
          </label>
          <input
            id={`${id}-family`}
            className={ui.input}
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            placeholder="Mi caligrafía"
          />
        </div>
        <div className={ui.field}>
          <label htmlFor={`${id}-file`} className={ui.label}>
            Archivo
          </label>
          <input
            id={`${id}-file`}
            type="file"
            accept=".ttf,.otf,font/ttf,font/otf"
            className={ui.input}
            disabled={busy}
            onChange={(e) => {
              void add(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {busy && <p className={ui.hint}>Subiendo…</p>}
      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Loads every curated font (and the custom ones) so the samples show the real typeface. */
function useAdminFonts() {
  const { control } = useFormContext<ContentForm>();
  const watched = useWatch({ control, name: 'public.customFonts' });
  // Stable reference: a fresh `[]` on each render would reload the fonts on every keystroke.
  const customFonts = useMemo(() => watched ?? [], [watched]);
  useEffect(() => {
    const refs: FontRef[] = [
      ...Object.values(CURATED_FONTS)
        .flat()
        .map((font) => ({ source: 'google' as const, family: font.family })),
      ...customFonts.map((font) => ({ source: 'custom' as const, id: font.id })),
    ];
    void loadFonts(refs, customFonts, { id: 'wi-admin-fonts' });
  }, [customFonts]);
}

function ThemeFields() {
  const { setValue, control } = useFormContext<ContentForm>();
  const couple = useWatch({ control, name: 'public.couple' });
  useAdminFonts();
  const names = `${couple?.bride || 'Novia'} & ${couple?.groom || 'Novio'}`;
  return (
    <>
      <div className={ui.card}>
        <h2 className={ui.cardTitle}>Colores</h2>
        <div className={styles.colors}>
          {(Object.keys(COLOR_LABELS) as ThemeColor[]).map((token) => (
            <ColorField key={token} token={token} />
          ))}
        </div>
        <ContrastWarnings />
      </div>

      <div className={ui.card}>
        <h2 className={ui.cardTitle}>Tipografías</h2>
        <div className={styles.fonts}>
          <FontField role="script" sample={names} />
          <FontField role="serif" sample="Tenemos el honor de invitarte a celebrar con nosotros" />
          <FontField role="sans" sample="SALIR · 15 de mayo" />
        </div>
      </div>

      <CustomFonts />

      <Btn
        variant="secondary"
        className={styles.reset}
        onClick={() =>
          setValue('public.theme', structuredClone(DEFAULT_THEME), {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      >
        Restaurar valores por defecto
      </Btn>
    </>
  );
}

export function ThemePage() {
  return <ContentEditor title="Diseño">{() => <ThemeFields />}</ContentEditor>;
}
