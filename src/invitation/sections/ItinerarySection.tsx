import { motion, useReducedMotion, useScroll } from 'motion/react';
import { useRef, type CSSProperties } from 'react';
import { Reveal } from '@/invitation/components/Reveal';
import { Icon } from '@/shared/icons/Icon';
import { formatTime12 } from '@/shared/utils/time';
import styles from './ItinerarySection.module.css';
import { Section, SectionTitle } from './Section';
import { sectionTitle, type SectionProps } from './types';

function Heart() {
  return (
    <svg viewBox="0 0 24 24" className={styles.heart} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16.5s-4.5-2.7-4.5-5.8A2.3 2.3 0 0 1 12 9.3a2.3 2.3 0 0 1 4.5 1.4c0 3.1-4.5 5.8-4.5 5.8z" />
    </svg>
  );
}

export function ItinerarySection({ content, entry }: SectionProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  // The line draws itself as the list scrolls through the screen.
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 85%', 'end 60%'] });

  if (content.itinerary.length === 0) return null;
  const titleId = 'itinerary-title';

  return (
    <Section content={content} entry={entry} labelledBy={titleId}>
      <Reveal>
        <SectionTitle id={titleId}>{sectionTitle(content, 'itinerary')}</SectionTitle>
      </Reveal>

      <div ref={listRef} className={styles.wrap}>
        <motion.span
          className={styles.line}
          style={reducedMotion ? undefined : { scaleY: scrollYProgress }}
          aria-hidden="true"
        />
        <ol
          className={styles.timeline}
          style={{ gridTemplateRows: `repeat(${content.itinerary.length + 1}, var(--row))` }}
        >
          {content.itinerary.map((item, i) => {
            const side = i % 2 === 0 ? 'left' : 'right';
            return (
              <li
                key={`${item.time}-${i}`}
                // display: contents drops the implicit role in Safari
                role="listitem"
                className={styles.item}
                data-side={side}
                style={{ '--item-row': `${i + 1} / span 2` } as CSSProperties}
              >
                <Heart />
                <Reveal from={side} className={styles.content}>
                  <Icon name={item.icon} size={56} className={styles.icon} />
                  <span className={styles.time}>{formatTime12(item.time)}</span>
                  <span className={styles.label}>{item.label}</span>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}
