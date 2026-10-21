import { AudioPlayer } from '@/invitation/audio/AudioPlayer';
import { Reveal } from '@/invitation/components/Reveal';
import { Crest } from '@/invitation/components/Stationery/Crest';
import { Section } from './Section';
import text from './text.module.css';
import type { SectionProps } from './types';

export function WelcomeSection({ content, entry }: SectionProps) {
  const { welcome, couple, music } = content;
  return (
    <Section content={content} entry={entry}>
      <Reveal>
        <Crest monogram={couple.monogram} label={`${couple.bride} y ${couple.groom}`} />
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
