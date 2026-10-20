import { TIMEZONE } from './date';

/** "15:00" → "3:00 p. m." (Peruvian style). */
export function formatTime12(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Calendar date (YYYY-MM-DD) of an instant, in Lima. */
export function limaDate(iso: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date(iso));
}

/** The instant of `time` (HH:mm, Lima) on the wedding day. Lima has no DST: always UTC−5. */
export function weddingInstant(weddingDateIso: string, time: string): Date {
  return new Date(`${limaDate(weddingDateIso)}T${time}:00-05:00`);
}
