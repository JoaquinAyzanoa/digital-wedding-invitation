import { Reveal } from '@/invitation/components/Reveal';
import { useToast } from '@/shared/toast/toastContext';
import { Icon } from '@/shared/icons/Icon';
import { UiIcon } from '@/shared/icons/UiIcon';
import { copyText } from '@/shared/utils/clipboard';
import styles from './GiftsSection.module.css';
import { Section, SectionTitle } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

export function GiftsSection({ content, invitation, entry }: SectionProps) {
  const toast = useToast();
  // Bank details only come with a valid code (private_data).
  const methods = invitation?.private.gifts ?? [];

  async function copy(value: string) {
    toast((await copyText(value)) ? 'Copiado' : 'No se pudo copiar');
  }

  return (
    <Section content={content} entry={entry} labelledBy="gifts-title">
      <Reveal className={styles.card}>
        <Icon name="gift" size={72} className={text.inkIcon} />
        <SectionTitle id="gifts-title">{sectionTitle(content, 'gifts')}</SectionTitle>
        {content.gifts.text && <p className={text.body}>{content.gifts.text}</p>}

        {methods.map((method, i) => (
          <div key={i} className={styles.method}>
            <p className={styles.label}>{method.label}</p>
            {method.lines.map((line, j) => (
              <p key={j} className={styles.line}>
                {line}
              </p>
            ))}
            {method.copy && (
              <button
                type="button"
                className={styles.copy}
                onClick={() => copy(method.copy!)}
                aria-label={`Copiar ${method.label}`}
              >
                <UiIcon name="copy" size={16} />
                Copiar
              </button>
            )}
          </div>
        ))}
      </Reveal>
    </Section>
  );
}
