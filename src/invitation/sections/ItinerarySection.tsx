import { motion, useReducedMotion } from 'motion/react';
import { Reveal } from '@/invitation/components/Reveal';
import { Icon } from '@/shared/icons/Icon';
import { formatTime12 } from '@/shared/utils/time';
import styles from './ItinerarySection.module.css';
import { Section, SectionTitle } from './Section';
import { sectionTitle, type SectionProps } from './types';

// The ink line from one moment to the next: it leaves the words of one row and reaches the
// words of the next, on the other side, with a little wobble, as if drawn by hand. Drawn for
// a 400 × 52 row (the list is at most 420 wide), so stretching barely changes the stroke.
const CONNECTOR_FROM_RIGHT =
  'M292 0C298 13 284 21 240 26C190 31 142 28 118 38C106 43 106 48 110 52';

function Connector({ fromSide }: { fromSide: 'left' | 'right' }) {
  const reducedMotion = useReducedMotion();
  return (
    <svg
      className={styles.connector}
      viewBox="0 0 400 52"
      preserveAspectRatio="none"
      aria-hidden="true"
      // Mirrored when the words of this row are on the left.
      style={fromSide === 'left' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <motion.path
        d={CONNECTOR_FROM_RIGHT}
        initial={reducedMotion ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.9, ease: 'easeInOut' }}
      />
    </svg>
  );
}

/**
 * "Programa del día": each moment is a drawing on one side and its time and name on the
 * other, alternating, joined by a hand-drawn line.
 */
export function ItinerarySection({ content, entry }: SectionProps) {
  if (content.itinerary.length === 0) return null;
  const titleId = 'itinerary-title';
  const last = content.itinerary.length - 1;

  return (
    <Section content={content} entry={entry} labelledBy={titleId}>
      <Reveal>
        <SectionTitle id={titleId}>{sectionTitle(content, 'itinerary')}</SectionTitle>
      </Reveal>

      <ol className={styles.program}>
        {content.itinerary.map((item, i) => {
          // The drawing goes left on the first row, then they alternate.
          const pictureSide = i % 2 === 0 ? 'left' : 'right';
          const wordsSide = pictureSide === 'left' ? 'right' : 'left';
          return (
            <li key={`${item.time}-${i}`} className={styles.moment} data-picture={pictureSide}>
              <Reveal from={pictureSide} className={styles.picture}>
                {item.image ? (
                  <img src={item.image} alt="" loading="lazy" decoding="async" />
                ) : (
                  <Icon name={item.icon} size={64} className={styles.icon} />
                )}
              </Reveal>
              <Reveal from={wordsSide} className={styles.words}>
                <span className={styles.time}>{formatTime12(item.time)}</span>
                <span className={styles.label}>{item.label}</span>
              </Reveal>
              {i < last && <Connector fromSide={wordsSide} />}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
