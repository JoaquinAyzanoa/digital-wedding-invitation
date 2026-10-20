import { describe, expect, it } from 'vitest';
import { countdown, datePartsInLima, dayMonthInLima } from './date';

describe('datePartsInLima', () => {
  it('formats the date in Spanish', () => {
    expect(datePartsInLima('2027-05-15T15:00:00-05:00')).toEqual({
      weekday: 'sábado',
      day: '15',
      month: 'mayo',
      year: '2027',
    });
  });

  it('uses Lima time, not UTC', () => {
    // 03:00 UTC on the 16th is still 22:00 on the 15th in Lima.
    expect(datePartsInLima('2027-05-16T03:00:00Z').day).toBe('15');
  });
});

describe('countdown', () => {
  const target = new Date('2027-05-15T15:00:00-05:00');

  it('splits the remaining time', () => {
    const now = new Date(target.getTime() - ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000);
    expect(countdown(target, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      done: false,
    });
  });

  it('rounds partial seconds down', () => {
    expect(countdown(target, new Date(target.getTime() - 1500)).seconds).toBe(1);
  });

  it('is done at and after the target', () => {
    expect(countdown(target, target).done).toBe(true);
    expect(countdown(target, new Date(target.getTime() + 60_000))).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      done: true,
    });
  });
});

describe('dayMonthInLima', () => {
  it('formats bare dates and datetimes', () => {
    expect(dayMonthInLima('2027-04-15')).toBe('15 de abril');
    expect(dayMonthInLima('2027-04-16T03:00:00Z')).toBe('15 de abril');
  });
});
