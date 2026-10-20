import { describe, expect, it } from 'vitest';
import { googleCalendarUrl, icsFile } from './calendar';
import { formatTime12, limaDate, weddingInstant } from './time';

describe('time', () => {
  it('formats 24 h times Peruvian style', () => {
    expect(formatTime12('15:00')).toBe('3:00 p. m.');
    expect(formatTime12('00:30')).toBe('12:30 a. m.');
    expect(formatTime12('12:05')).toBe('12:05 p. m.');
    expect(formatTime12('09:15')).toBe('9:15 a. m.');
  });

  it('places event times on the wedding day in Lima', () => {
    expect(limaDate('2027-05-16T03:00:00Z')).toBe('2027-05-15');
    expect(weddingInstant('2027-05-15T15:00:00-05:00', '16:30').toISOString()).toBe(
      '2027-05-15T21:30:00.000Z',
    );
  });
});

const event = {
  title: 'Boda de Valeria & Mateo: Ceremonia',
  start: new Date('2027-05-15T20:00:00Z'),
  end: new Date('2027-05-15T21:00:00Z'),
  location: 'Parroquia Demo, Av. Ejemplo 123; Lima',
};

describe('google calendar', () => {
  it('builds a template link in UTC', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get('dates')).toBe('20270515T200000Z/20270515T210000Z');
    expect(url.searchParams.get('text')).toBe(event.title);
    expect(url.searchParams.get('location')).toBe(event.location);
  });
});

describe('ics', () => {
  const ics = icsFile(event, 'ceremony@wedding', new Date('2026-10-20T00:00:00Z'));

  it('has the event in UTC with escaped text and CRLF lines', () => {
    expect(ics).toContain('DTSTART:20270515T200000Z\r\n');
    expect(ics).toContain('LOCATION:Parroquia Demo\\, Av. Ejemplo 123\\; Lima\r\n');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  });

  it('folds lines longer than 75 octets', () => {
    const long = icsFile({ ...event, details: 'á'.repeat(100) }, 'x');
    for (const line of long.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
