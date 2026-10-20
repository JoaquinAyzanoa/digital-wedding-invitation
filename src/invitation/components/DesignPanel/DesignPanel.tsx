import { useEffect, useState } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { ICON_KEYS, type FontRef } from '@/shared/schemas/content';
import { CURATED_FONTS, fontStack, loadFonts } from '@/shared/theme/fonts';
import { Button, ButtonLink } from '@/shared/ui/Button';
import styles from './DesignPanel.module.css';

const SCRIPT_REFS: FontRef[] = CURATED_FONTS.script.map((font) => ({
  source: 'google',
  family: font.family,
}));

interface DesignPanelProps {
  sample: string;
  value: FontRef;
  onChange: (font: FontRef) => void;
}

/** Review tool (`?design=1`): try every curated script font on the real names; see icons and buttons. */
export function DesignPanel({ sample, value, onChange }: DesignPanelProps) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'fonts' | 'icons' | 'buttons'>('fonts');

  useEffect(() => {
    void loadFonts(SCRIPT_REFS, [], { id: 'wi-design-panel-fonts' });
  }, []);

  const selected = value.source === 'google' ? value.family : null;

  return (
    <aside className={styles.panel} data-open={open}>
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'fonts'}
            onClick={() => setTab('fonts')}
          >
            Caligrafía
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'icons'}
            onClick={() => setTab('icons')}
          >
            Íconos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'buttons'}
            onClick={() => setTab('buttons')}
          >
            Botones
          </button>
        </div>
        <button type="button" className={styles.toggle} onClick={() => setOpen(!open)}>
          {open ? 'Ocultar' : 'Diseño'}
        </button>
      </div>

      {open && tab === 'fonts' && (
        <ul className={styles.fonts}>
          {SCRIPT_REFS.map((ref) => {
            const family = ref.source === 'google' ? ref.family : '';
            return (
              <li key={family}>
                <button
                  type="button"
                  className={styles.font}
                  aria-pressed={family === selected}
                  onClick={() => onChange(ref)}
                >
                  <span className={styles.sample} style={{ fontFamily: fontStack(ref, 'script') }}>
                    {sample}
                  </span>
                  <span className={styles.family}>{family}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && tab === 'icons' && (
        <ul className={styles.icons}>
          {ICON_KEYS.map((key) => (
            <li key={key}>
              <Icon name={key} size={44} />
              <span>{key}</span>
            </li>
          ))}
        </ul>
      )}
      {open && tab === 'buttons' && (
        <div className={styles.buttons}>
          <ButtonLink href="https://maps.google.com">Ver ubicación</ButtonLink>
          <Button>Confirma aquí</Button>
          <Button variant="outline">Agregar al calendario</Button>
          <Button disabled>Enviando…</Button>
        </div>
      )}
    </aside>
  );
}
