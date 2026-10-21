import { Reveal } from '@/invitation/components/Reveal';
import { Icon } from '@/shared/icons/Icon';
import { ButtonLink } from '@/shared/ui/Button';
import { colorName } from '@/shared/utils/colorName';
import styles from './DressCodeSection.module.css';
import { Section, SectionTitle } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

export function DressCodeSection({ content, entry }: SectionProps) {
  const { title, notes, avoidColors, inspirationUrl } = content.dressCode;
  return (
    <Section content={content} entry={entry} labelledBy="dresscode-title">
      <Reveal className={styles.icons}>
        <Icon name="dress" size={84} className={text.goldIcon} />
        <Icon name="suit" size={84} className={text.goldIcon} />
      </Reveal>
      <Reveal>
        <SectionTitle id="dresscode-title">{sectionTitle(content, 'dressCode')}</SectionTitle>
      </Reveal>
      {title && (
        <Reveal>
          <p className={styles.code}>{title}</p>
        </Reveal>
      )}
      {notes.length > 0 && (
        <Reveal>
          {notes.map((note) => (
            <p key={note} className={text.body}>
              {note}
            </p>
          ))}
        </Reveal>
      )}
      {inspirationUrl && (
        <Reveal>
          <ButtonLink href={inspirationUrl}>Ver inspiración</ButtonLink>
        </Reveal>
      )}
      {avoidColors.length > 0 && (
        <Reveal className={styles.avoid}>
          <p id="avoid-colors" className={styles.avoidTitle}>
            Colores a evitar
          </p>
          <ul className={styles.swatches} aria-labelledby="avoid-colors">
            {avoidColors.map((color, i) => (
              <li key={`${color}-${i}`} className={styles.swatch} style={{ background: color }}>
                <span className="visually-hidden">{colorName(color)}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </Section>
  );
}
