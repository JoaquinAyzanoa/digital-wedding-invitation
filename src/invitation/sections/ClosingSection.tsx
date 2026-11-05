import { motion } from 'motion/react';
import { useContext } from 'react';
import { Reveal } from '@/invitation/components/Reveal';
import { RevealContext } from '@/invitation/components/revealContext';
import styles from './ClosingSection.module.css';
import { SlotPhoto } from './PhotoSection';
import { Section } from './Section';
import type { SectionProps } from './types';

const INFINITY =
  'M24 24c-4-5-7.5-8-11.5-8a8 8 0 0 0 0 16c4 0 7.5-3 11.5-8s7.5-8 11.5-8a8 8 0 0 1 0 16c-4 0-7.5-3-11.5-8z';

export function ClosingSection({ content, entry }: SectionProps) {
  const revealEnabled = useContext(RevealContext);
  const { closingPhrase, closingSymbol } = content;
  return (
    <>
      {(closingSymbol || closingPhrase) && (
        <Section content={content} entry={entry}>
          {closingSymbol && (
            <svg viewBox="0 0 48 48" className={styles.infinity} aria-hidden="true">
              {revealEnabled && (
                <motion.path
                  d={INFINITY}
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 1.8, ease: 'easeInOut' }}
                />
              )}
            </svg>
          )}
          {closingPhrase && (
            <Reveal delay={closingSymbol ? 0.4 : 0}>
              <p className={styles.phrase}>{closingPhrase}</p>
            </Reveal>
          )}
        </Section>
      )}
      <SlotPhoto content={content} slot="closing" />
    </>
  );
}
