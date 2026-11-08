import { Reveal } from '@/invitation/components/Reveal';
import { Section } from './Section';
import text from './text.module.css';
import type { SectionProps } from './types';

export function WelcomeSection({ content, entry }: SectionProps) {
  const { welcome } = content;
  // Emptied in the editor: no blank space (and no garland) at the top of the page.
  if (!welcome.text && !welcome.quote) return null;
  return (
    <Section content={content} entry={entry}>
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
    </Section>
  );
}
