import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from '@/shared/utils/calendar';
import styles from './AddToCalendar.module.css';

interface AddToCalendarProps {
  event: CalendarEvent;
  /** Globally unique, so re-importing updates the same entry. */
  uid: string;
  filename: string;
  /**
   * Beside another button: smaller, a shorter label, and the options open on their own line
   * below both (the parent is a wrapping flex row).
   */
  inline?: boolean;
}

/** Outline button that reveals Google Calendar and .ics (Apple / Outlook) options. */
export function AddToCalendar({ event, uid, filename, inline = false }: AddToCalendarProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={inline ? styles.inline : styles.calendar}>
      <Button
        variant="outline"
        size={inline ? 'small' : 'normal'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {inline ? 'Agendar' : 'Agregar al calendario'}
      </Button>
      {open && (
        <div className={styles.options}>
          <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
            Google Calendar
          </a>
          <button type="button" onClick={() => downloadIcs(event, uid, filename)}>
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
