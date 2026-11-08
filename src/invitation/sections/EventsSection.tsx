import { AddToCalendar } from '@/invitation/components/AddToCalendar/AddToCalendar';
import {
  calendarUid,
  eventCalendarEntry,
} from '@/invitation/components/AddToCalendar/weddingEvents';
import { Reveal } from '@/invitation/components/Reveal';
import { Icon } from '@/shared/icons/Icon';
import { ButtonLink } from '@/shared/ui/Button';
import styles from './EventsSection.module.css';
import { Section } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

/** "¿Cómo llegar?": where each event is, with its map (the times are in the itinerary). */
export function EventsSection({ content, entry }: SectionProps) {
  if (content.events.length === 0) return null;
  return (
    <Section content={content} entry={entry} labelledBy="events-title">
      <Reveal className={styles.places}>
        <Icon name="location" size={34} className={text.goldIcon} />
        <h2 id="events-title" className={styles.title}>
          {sectionTitle(content, 'events')}
        </h2>
        {content.events.map((event, i) => (
          <div key={`${event.kind}-${i}`} className={styles.place}>
            <h3 className={styles.kind}>Ubicación {event.title.toLowerCase()}</h3>
            <p className={styles.venue}>{event.venue}</p>
            {event.address && <p className={styles.address}>{event.address}</p>}
            <div className={styles.actions}>
              {event.mapsUrl && (
                <ButtonLink href={event.mapsUrl} size="small">
                  Ver mapa
                </ButtonLink>
              )}
              <AddToCalendar
                event={eventCalendarEntry(event, content)}
                uid={calendarUid(event.kind, content)}
                filename={`boda-${event.kind}.ics`}
                inline
              />
            </div>
          </div>
        ))}
      </Reveal>
    </Section>
  );
}
