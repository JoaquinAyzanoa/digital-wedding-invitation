import { Reveal } from '@/invitation/components/Reveal';
import { Icon } from '@/shared/icons/Icon';
import styles from './DressCodeSection.module.css';
import { Section, SectionTitle } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

export function DressCodeSection({ content, entry }: SectionProps) {
  const { title, notes } = content.dressCode;
  return (
    <Section content={content} entry={entry} labelledBy="dresscode-title">
      <Reveal className={styles.icons}>
        <Icon name="dress" size={84} className={text.primaryIcon} />
        <Icon name="suit" size={84} className={text.inkIcon} />
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
    </Section>
  );
}
