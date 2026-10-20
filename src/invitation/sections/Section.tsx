import type { ReactNode } from 'react';
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
  return (
    <section
      className={[styles.section, className].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy}
    >
      {flowers && (
        <img
          className={styles.decor}
          data-side={entry.decor}
          src={flowers}
          alt=""
          loading="lazy"
          decoding="async"
        />
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
