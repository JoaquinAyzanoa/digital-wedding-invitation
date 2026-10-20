import { Reveal } from '@/invitation/components/Reveal';
import { Section } from './Section';
import text from './text.module.css';
import type { SectionProps } from './types';

export function FarewellSection({ content, entry }: SectionProps) {
  if (!content.farewell) return null;
  return (
    <Section content={content} entry={entry}>
      <Reveal>
        <p className={text.upper} style={{ maxWidth: '22ch', fontSize: 21 }}>
          {content.farewell}
        </p>
      </Reveal>
    </Section>
  );
}
