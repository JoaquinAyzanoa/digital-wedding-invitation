import { useCallback } from 'react';
import { AddToCalendar } from '@/invitation/components/AddToCalendar/AddToCalendar';
import {
  calendarUid,
  weddingCalendarEntry,
} from '@/invitation/components/AddToCalendar/weddingEvents';
import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationView, RsvpResponse } from '@/shared/schemas/invitation';
import { Button } from '@/shared/ui/Button';
import { dayMonthInLima } from '@/shared/utils/date';
import styles from './RsvpSummary.module.css';

function attendeeLine(attendee: RsvpResponse['attendees'][number]) {
  const age =
    attendee.kind === 'child' && attendee.age !== null
      ? ` (${attendee.age === 0 ? 'menos de 1 año' : `${attendee.age} ${attendee.age === 1 ? 'año' : 'años'}`})`
      : '';
  return [`${attendee.fullName}${age}`, attendee.menu].filter(Boolean).join(' · ');
}

function partsLine(response: RsvpResponse, content: PublicContent) {
  const { ceremony, reception } = response.parts;
  if (ceremony && reception) return null;
  const event = content.events.find((e) => e.kind === (ceremony ? 'ceremony' : 'reception'));
  return `Solo ${event?.title.toLowerCase() ?? (ceremony ? 'ceremonia' : 'recepción')}`;
}

interface RsvpSummaryProps {
  content: PublicContent;
  invitation: InvitationView & { response: RsvpResponse };
  onChange: () => void;
  /** Focus the heading when shown right after answering. */
  focusOnMount?: boolean;
}

export function RsvpSummary({ content, invitation, onChange, focusOnMount }: RsvpSummaryProps) {
  const { response } = invitation;
  const count = response.attendees.length;
  const headingRef = useCallback(
    (element: HTMLHeadingElement | null) => {
      if (element && focusOnMount) element.focus();
    },
    [focusOnMount],
  );

  return (
    <div className={styles.summary}>
      <h3 ref={headingRef} tabIndex={-1} className={styles.title}>
        {response.attending ? '¡Gracias por confirmar!' : 'Gracias por avisarnos'}
      </h3>

      {response.attending ? (
        <>
          <p>{count === 1 ? 'Asistirá 1 persona:' : `Asistirán ${count} personas:`}</p>
          <ul className={styles.list}>
            {response.attendees.map((attendee, i) => (
              <li key={i}>{attendeeLine(attendee)}</li>
            ))}
          </ul>
          {content.rsvp.questions.parts && partsLine(response, content) && (
            <p>{partsLine(response, content)}</p>
          )}
        </>
      ) : (
        <p>Lamentamos que no puedan acompañarnos. ¡Los tendremos presentes!</p>
      )}

      <p className={styles.date}>Respuesta registrada el {dayMonthInLima(response.respondedAt)}.</p>

      {response.attending && (
        <AddToCalendar
          event={weddingCalendarEntry(content)}
          uid={calendarUid('boda', content)}
          filename="boda.ics"
        />
      )}

      {invitation.rsvpOpen ? (
        <>
          <Button variant="outline" onClick={onChange}>
            Cambiar mi respuesta
          </Button>
          <p className={styles.date}>
            Puedes cambiarla hasta el {dayMonthInLima(content.rsvp.deadline)}.
          </p>
        </>
      ) : (
        <p className={styles.date}>
          {content.rsvp.closedText ||
            'La confirmación ya cerró. Si necesitas cambiar algo, escríbenos.'}
        </p>
      )}
    </div>
  );
}
