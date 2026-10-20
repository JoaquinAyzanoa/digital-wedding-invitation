import type { PublicContent } from '@/shared/schemas/content';
import type { CalendarEvent } from '@/shared/utils/calendar';
import { limaDate, weddingInstant } from '@/shared/utils/time';

type WeddingEvent = PublicContent['events'][number];

// Calendar entries need an end; sensible defaults for each part of the day.
const DURATION_MINUTES: Record<WeddingEvent['kind'], number> = { ceremony: 60, reception: 360 };

function names(content: PublicContent) {
  return `${content.couple.bride} & ${content.couple.groom}`;
}

export function eventCalendarEntry(event: WeddingEvent, content: PublicContent): CalendarEvent {
  const start = weddingInstant(content.date, event.time);
  return {
    title: `${event.title} · ${names(content)}`,
    start,
    end: new Date(start.getTime() + DURATION_MINUTES[event.kind] * 60_000),
    location: [event.venue, event.address].filter(Boolean).join(', '),
    details: event.mapsUrl,
  };
}

/** The whole day, from the first event to the end of the last one (for the RSVP summary). */
export function weddingCalendarEntry(content: PublicContent): CalendarEvent {
  const entries = content.events.map((event) => eventCalendarEntry(event, content));
  const first = entries[0];
  const last = entries[entries.length - 1];
  const start = first?.start ?? new Date(content.date);
  return {
    title: `Boda de ${names(content)}`,
    start,
    end: last?.end ?? new Date(start.getTime() + 6 * 3_600_000),
    location: first?.location,
    details: content.events.map((e) => `${e.title}: ${e.venue}`).join('\n'),
  };
}

export function calendarUid(name: string, content: PublicContent): string {
  return `${name}-${limaDate(content.date)}@${window.location.host || 'boda'}`;
}
