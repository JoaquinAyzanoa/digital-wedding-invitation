import { useState } from 'react';
import { Reveal } from '@/invitation/components/Reveal';
import { Icon } from '@/shared/icons/Icon';
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from '@/shared/utils/calendar';
import { formatTime12, weddingInstant } from '@/shared/utils/time';
import { Button, ButtonLink } from '@/shared/ui/Button';
import styles from './EventsSection.module.css';
import { Section } from './Section';
import text from './text.module.css';
import type { SectionProps } from './types';

type WeddingEvent = SectionProps['content']['events'][number];

// Calendar entries need an end; these are sensible defaults for each part of the day.
const DURATION_MINUTES: Record<WeddingEvent['kind'], number> = { ceremony: 60, reception: 360 };

function calendarEvent(event: WeddingEvent, content: SectionProps['content']): CalendarEvent {
  const start = weddingInstant(content.date, event.time);
  return {
    title: `${event.title} · ${content.couple.bride} & ${content.couple.groom}`,
    start,
    end: new Date(start.getTime() + DURATION_MINUTES[event.kind] * 60_000),
    location: [event.venue, event.address].filter(Boolean).join(', '),
    details: event.mapsUrl,
  };
}

function AddToCalendar({ event, uid }: { event: CalendarEvent; uid: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.calendar}>
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>
        Agregar al calendario
      </Button>
      {open && (
        <div className={styles.calendarOptions}>
          <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
            Google Calendar
          </a>
          <button type="button" onClick={() => downloadIcs(event, uid, `${uid}.ics`)}>
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}

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
          {event.intro && <p className={text.body}>{event.intro}</p>}
          <p className={styles.time}>Hora: {formatTime12(event.time)}</p>
          <p className={text.upper}>{event.venue}</p>
          {event.address && <p className={styles.address}>{event.address}</p>}
          <div className={styles.actions}>
            {event.mapsUrl && <ButtonLink href={event.mapsUrl}>Ver ubicación</ButtonLink>}
            <AddToCalendar event={calendarEvent(event, content)} uid={`boda-${event.kind}`} />
          </div>
        </Reveal>
      ))}
    </Section>
  );
}
