import { Countdown } from '@/invitation/components/Countdown/Countdown';
import { Reveal } from '@/invitation/components/Reveal';
import type { PublicContent } from '@/shared/schemas/content';
import { datePartsInLima } from '@/shared/utils/date';
import styles from './DateSection.module.css';

interface DateSectionProps {
  content: Pick<PublicContent, 'couple' | 'date' | 'dateIntro'>;
}

export function DateSection({ content }: DateSectionProps) {
  const { bride, groom } = content.couple;
  const { weekday, day, month, year } = datePartsInLima(content.date);

  return (
    <section className={styles.section} aria-labelledby="date-names">
      <Reveal>
        <p className={styles.kicker}>¡Nos casamos!</p>
      </Reveal>

      <Reveal delay={0.1}>
        <h2 id="date-names" className={styles.names}>
          <span className={styles.bride}>{bride}</span>
          <span className={styles.amp}>&amp;</span>
          <span className={styles.groom}>{groom}</span>
        </h2>
      </Reveal>

      {content.dateIntro && (
        <Reveal>
          <p className={styles.intro}>{content.dateIntro}</p>
        </Reveal>
      )}

      <Reveal>
        <div className={styles.date}>
          <span className={styles.month}>{month}</span>
          <div className={styles.row}>
            <span className={styles.side}>{weekday}</span>
            <span className={styles.day}>{day}</span>
            <span className={styles.side}>{year}</span>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <Countdown target={content.date} />
      </Reveal>
    </section>
  );
}
