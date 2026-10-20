import { motion } from 'motion/react';
import { useContext, type ReactNode } from 'react';
import { RevealContext } from '@/invitation/components/revealContext';
import styles from './Section.module.css';
import type { SectionProps } from './types';

interface SectionShellProps extends Pick<SectionProps, 'content' | 'entry'> {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}

/** Common padding and the optional watercolor flowers (`decorations.side`) on one side. */
export function Section({ content, entry, children, className, labelledBy }: SectionShellProps) {
  const flowers = entry.decor ? content.decorations.side : undefined;
  const revealEnabled = useContext(RevealContext);
  return (
    <section
      className={[styles.section, className].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy}
    >
      {flowers && revealEnabled && (
        // Wrapper animates; the image keeps its mirror transform for the left side.
        <motion.div
          className={styles.decor}
          data-side={entry.decor}
          initial={{ opacity: 0, x: entry.decor === 'left' ? -20 : 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src={flowers} alt="" loading="lazy" decoding="async" />
        </motion.div>
      )}
      <div className={styles.inner}>{children}</div>
    </section>
  );
}

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className={styles.title}>
      {children}
    </h2>
  );
}
