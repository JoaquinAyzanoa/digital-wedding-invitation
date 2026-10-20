import { AudioPlayer } from '@/invitation/audio/AudioPlayer';
import { Reveal } from '@/invitation/components/Reveal';
import { Section } from './Section';
import styles from './WelcomeSection.module.css';
import text from './text.module.css';
import type { SectionProps } from './types';

export function WelcomeSection({ content, entry }: SectionProps) {
  const { welcome, couple, music } = content;
  return (
    <Section content={content} entry={entry}>
      <Reveal>
        <p className={styles.monogram} aria-label={`${couple.bride} y ${couple.groom}`}>
          {couple.monogram}
        </p>
      </Reveal>
      {welcome.text && (
        <Reveal>
          <p className={text.body}>{welcome.text}</p>
        </Reveal>
      )}
      {welcome.quote && (
        <Reveal>
          <p className={text.quote}>{welcome.quote}</p>
        </Reveal>
      )}
      {music?.url && (
        <Reveal>
          <AudioPlayer label={music.title || 'Dale play a nuestra canción'} />
        </Reveal>
      )}
    </Section>
  );
}
