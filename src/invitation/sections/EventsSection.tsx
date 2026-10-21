import { AddToCalendar } from '@/invitation/components/AddToCalendar/AddToCalendar';
import {
  calendarUid,
  eventCalendarEntry,
} from '@/invitation/components/AddToCalendar/weddingEvents';
import { Reveal } from '@/invitation/components/Reveal';
import { Flourish } from '@/invitation/components/Stationery/Flourish';
import { Icon } from '@/shared/icons/Icon';
import { ButtonLink } from '@/shared/ui/Button';
import { formatTime12 } from '@/shared/utils/time';
import styles from './EventsSection.module.css';
import { Section } from './Section';
import text from './text.module.css';
import type { SectionProps } from './types';

export function EventsSection({ content, entry }: SectionProps) {
  if (content.events.length === 0) return null;
  return (
    <Section content={content} entry={entry}>
      {content.events.map((event, i) => (
        <Reveal key={`${event.kind}-${i}`} className={styles.event}>
          <Icon
            name={event.kind === 'ceremony' ? 'church' : 'glasses'}
            size={84}
            className={text.goldIcon}
          />
          <h2 className={styles.title}>{event.title}</h2>
          <Flourish />
          {event.intro && <p className={text.body}>{event.intro}</p>}
          <p className={styles.time}>Hora: {formatTime12(event.time)}</p>
          <p className={text.upper}>{event.venue}</p>
          {event.address && <p className={styles.address}>{event.address}</p>}
          <div className={styles.actions}>
            {event.mapsUrl && <ButtonLink href={event.mapsUrl}>Ver ubicación</ButtonLink>}
            <AddToCalendar
              event={eventCalendarEntry(event, content)}
              uid={calendarUid(event.kind, content)}
              filename={`boda-${event.kind}.ics`}
            />
          </div>
        </Reveal>
      ))}
    </Section>
  );
}
