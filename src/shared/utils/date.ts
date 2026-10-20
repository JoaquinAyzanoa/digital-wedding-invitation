export const TIMEZONE = 'America/Lima';
const LOCALE = 'es-PE';

export interface DateParts {
  weekday: string;
  day: string;
  month: string;
  year: string;
}

/** Weekday, day, month and year of an instant as seen in Lima, in Spanish (lowercase). */
export function datePartsInLima(iso: string): DateParts {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return { weekday: get('weekday'), day: get('day'), month: get('month'), year: get('year') };
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function countdown(target: Date, now: Date): Countdown {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: false,
  };
}

/** "15 de abril" for a bare date (read in Lima) or an ISO datetime. */
export function dayMonthInLima(dateOrDateTime: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(dateOrDateTime)
    ? `${dateOrDateTime}T12:00:00-05:00`
    : dateOrDateTime;
  const { day, month } = datePartsInLima(iso);
  return `${day} de ${month}`;
}
