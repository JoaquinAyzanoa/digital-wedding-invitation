import type { ReactNode } from 'react';
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
  const flowers = content.decorations.gifts;

  async function copy(value: string) {
    toast((await copyText(value)) ? 'Copiado' : 'No se pudo copiar');
  }

  return (
    <Section content={content} entry={entry} labelledBy="gifts-title">
      <Reveal className={styles.card}>
        <Icon name="gift" size={72} className={text.goldIcon} />
        <SectionTitle id="gifts-title">{sectionTitle(content, 'gifts')}</SectionTitle>
        {content.gifts.text && <p className={text.body}>{content.gifts.text}</p>}

        <div className={styles.notes}>
          {methods.map((method, i) => (
            <Note key={i} index={i} flowers={i === methods.length - 1 ? flowers : undefined}>
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
                  <UiIcon name="copy" size={15} />
                  Copiar
                </button>
              )}
            </Note>
          ))}
          {/* Without a personal link the details are not sent at all: say where to find them,
            so the text does not end on "estos son los medios disponibles:" and nothing. */}
          {!invitation && (
            <Note index={0} flowers={flowers}>
              <p className={styles.private}>Los datos están en tu invitación personal.</p>
            </Note>
          )}
        </div>
      </Reveal>
    </Section>
  );
}

/** A note pinned to the page, askew, swaying a little; the last one holds the flowers. */
function Note({
  index,
  flowers,
  children,
}: {
  index: number;
  flowers?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Reveal className={styles.noteWrap}>
      <div className={styles.note} data-tilt={index % 2 ? 'right' : 'left'}>
        <Pin />
        <CardIcon />
        {children}
        {flowers && (
          <img className={styles.flowers} src={flowers} alt="" loading="lazy" decoding="async" />
        )}
      </div>
    </Reveal>
  );
}

/** A pearl-headed pin, with its shadow on the paper. */
function Pin() {
  return (
    <svg className={styles.pin} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id="gift-pin" cx="36%" cy="32%" r="70%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#E7E2DD" />
          <stop offset="1" stopColor="#A9A29B" />
        </radialGradient>
      </defs>
      <ellipse cx="19" cy="21" rx="8" ry="4.5" fill="rgb(60 50 40 / 0.22)" />
      <circle cx="15" cy="14" r="9" fill="url(#gift-pin)" />
      <ellipse cx="12" cy="10.5" rx="3" ry="2" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}

/** A bank card, drawn in fine line. */
function CardIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 40 30" aria-hidden="true">
      <rect x="2" y="3" width="36" height="24" rx="3" />
      <path d="M2 10h36" />
      <rect x="7" y="16" width="8" height="6" rx="1" />
      <path d="M20 20h12M20 23h7" />
    </svg>
  );
}
