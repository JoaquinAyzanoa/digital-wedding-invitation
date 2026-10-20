import { describe, expect, it } from 'vitest';
import {
  emptyAttendee,
  rsvpDefaults,
  rsvpFormSchema,
  toRsvpInput,
  type RsvpFormValues,
} from './rsvp';

const questions = { transport: true, lodging: false, song: true, parts: true };
const schema = rsvpFormSchema({ seats: 3, menuOptions: ['Carne', 'Infantil'], questions });

function values(overrides: Partial<RsvpFormValues> = {}): RsvpFormValues {
  return {
    attending: true,
    attendees: [{ ...emptyAttendee('Ana Pérez'), menu: 'Carne' }],
    parts: { ceremony: true, reception: true },
    needsTransport: false,
    needsLodging: null,
    contactPhone: '',
    songRequest: '',
    message: '',
    ...overrides,
  };
}

const paths = (input: RsvpFormValues) =>
  schema.safeParse(input).error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('rsvpFormSchema', () => {
  it('accepts a complete answer', () => {
    expect(paths(values())).toEqual([]);
  });

  it('asks to choose attending or not', () => {
    const result = schema.safeParse(values({ attending: null }));
    expect(result.error?.issues[0]).toMatchObject({
      path: ['attending'],
      message: 'Elige una opción',
    });
  });

  it('declining ignores the attendee cards', () => {
    expect(paths(values({ attending: false, attendees: [emptyAttendee()] }))).toEqual([]);
  });

  it('validates each attendee', () => {
    const attendees = [
      { ...emptyAttendee(' '), menu: 'Carne' },
      { ...emptyAttendee('Mateo'), kind: 'child' as const, menu: 'Infantil' },
      { ...emptyAttendee('Luis'), menu: 'Sushi' },
    ];
    expect(paths(values({ attendees }))).toEqual([
      'attendees.0.fullName',
      'attendees.1.age',
      'attendees.2.menu',
    ]);
  });

  it('limits attendees to the reserved seats', () => {
    const one = { ...emptyAttendee('A'), menu: 'Carne' };
    expect(paths(values({ attendees: [one, one, one, one] }))).toEqual(['attendees']);
    expect(paths(values({ attendees: [] }))).toEqual(['attendees']);
  });

  it('requires enabled questions and at least one part of the day', () => {
    expect(
      paths(values({ needsTransport: null, parts: { ceremony: false, reception: false } })),
    ).toEqual(['parts', 'needsTransport']);
  });

  it('checks the phone format', () => {
    expect(paths(values({ contactPhone: 'abc' }))).toEqual(['contactPhone']);
    expect(paths(values({ contactPhone: '+51 987 654 321' }))).toEqual([]);
  });
});

describe('toRsvpInput', () => {
  it('drops answers to disabled questions and empty texts', () => {
    const input = toRsvpInput(
      values({ needsLodging: true, songRequest: '  ', contactPhone: ' 987654321 ' }),
      { ...questions, song: false, parts: false },
    );
    expect(input).toEqual({
      attending: true,
      attendees: [
        { fullName: 'Ana Pérez', kind: 'adult', age: null, menu: 'Carne', dietary: null },
      ],
      needsTransport: false,
      needsLodging: null,
      songRequest: null,
      contactPhone: '987654321',
      message: null,
    });
  });

  it('sends no attendees when declining', () => {
    expect(toRsvpInput(values({ attending: false, message: 'Lo siento' }), questions)).toEqual({
      attending: false,
      attendees: [],
      contactPhone: null,
      message: 'Lo siento',
    });
  });
});

describe('rsvpDefaults', () => {
  it('prefills the name of an individual invitation', () => {
    expect(rsvpDefaults({ displayName: 'Ana Pérez', seats: 1, response: null }).attendees).toEqual([
      emptyAttendee('Ana Pérez'),
    ]);
    expect(
      rsvpDefaults({ displayName: 'Familia Pérez', seats: 4, response: null }).attendees,
    ).toEqual([emptyAttendee()]);
  });
});
