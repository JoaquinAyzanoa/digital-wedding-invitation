import { describe, expect, it } from 'vitest';
import {
  emptyAttendee,
  rsvpDefaults,
  rsvpFormSchema,
  toRsvpInput,
  type RsvpFormValues,
} from './rsvp';

const questions = {
  transport: true,
  lodging: false,
  song: true,
  parts: true,
  dni: false,
  children: true,
};
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

  it('declining ignores the attendee step (cards and phone)', () => {
    expect(
      paths(values({ attending: false, attendees: [emptyAttendee()], contactPhone: 'abc' })),
    ).toEqual([]);
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
        {
          fullName: 'Ana Pérez',
          kind: 'adult',
          age: null,
          menu: 'Carne',
          dietary: null,
          dni: null,
        },
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

describe('DNI', () => {
  const withDni = rsvpFormSchema({
    seats: 3,
    menuOptions: [],
    questions: { ...questions, dni: true },
  });
  const issues = (input: RsvpFormValues, schemaToUse = withDni) =>
    schemaToUse.safeParse(input).error?.issues.map((i) => [i.path.join('.'), i.message]) ?? [];
  const person = (fullName: string, dni: string, extra = {}) => ({
    ...emptyAttendee(fullName),
    dni,
    ...extra,
  });

  it('is required for everyone and has 8 digits', () => {
    expect(issues(values({ attendees: [person('Ana', '')] }))).toEqual([
      ['attendees.0.dni', 'Escribe el DNI'],
    ]);
    expect(issues(values({ attendees: [person('Ana', '1234567a')] }))).toEqual([
      ['attendees.0.dni', 'El DNI tiene 8 números'],
    ]);
    expect(issues(values({ attendees: [person('Mateo', '', { kind: 'child', age: 6 })] }))).toEqual(
      [['attendees.0.dni', 'Escribe el DNI']],
    );
    expect(issues(values({ attendees: [person('Ana', '01234567')] }))).toEqual([]);
  });

  it('cannot repeat within the invitation', () => {
    expect(
      issues(values({ attendees: [person('Ana', '12345678'), person('Luis', '12345678')] })),
    ).toEqual([['attendees.1.dni', 'Este DNI ya está en otra persona']]);
  });

  it('may stay empty when already given for the same name (changing the answer)', () => {
    const saved = { savedDniHint: '678', savedName: 'Ana Pérez' };
    expect(issues(values({ attendees: [person(' ana pérez ', '', saved)] }))).toEqual([]);
    expect(issues(values({ attendees: [person('Rosa Pérez', '', saved)] }))).toEqual([
      ['attendees.0.dni', 'Escribe el DNI'],
    ]);
  });

  it('is optional for the admin', () => {
    const admin = rsvpFormSchema({
      seats: 3,
      menuOptions: [],
      questions: { ...questions, dni: true },
      dniOptional: true,
    });
    expect(issues(values({ attendees: [person('Ana', '')] }), admin)).toEqual([]);
    expect(issues(values({ attendees: [person('Ana', '123')] }), admin)).toEqual([
      ['attendees.0.dni', 'El DNI tiene 8 números'],
    ]);
  });

  it('is sent only while asked, empty as null (the server keeps the saved one)', () => {
    const form = values({ attendees: [person('Ana', ' 12345678 '), person('Luis', '')] });
    expect(toRsvpInput(form, { ...questions, dni: true }).attendees.map((a) => a.dni)).toEqual([
      '12345678',
      null,
    ]);
    expect(toRsvpInput(form, questions).attendees.map((a) => a.dni)).toEqual([null, null]);
  });

  it('comes back to the guest only as a hint', () => {
    const defaults = rsvpDefaults({
      displayName: 'Familia',
      seats: 2,
      response: {
        attending: true,
        parts: { ceremony: true, reception: true },
        needsTransport: null,
        needsLodging: null,
        contactPhone: null,
        songRequest: null,
        message: null,
        respondedAt: '2026-10-20T00:00:00Z',
        attendees: [
          { fullName: 'Ana', kind: 'adult', age: null, menu: null, dietary: null, dniHint: '678' },
        ],
      },
    });
    expect(defaults.attendees[0]).toMatchObject({ dni: '', savedDniHint: '678', savedName: 'Ana' });
  });
});

describe('without children at the wedding', () => {
  const adultsOnly = { ...questions, children: false };
  const schemaAdults = rsvpFormSchema({ seats: 3, menuOptions: [], questions: adultsOnly });

  it('does not ask the age and sends everyone as an adult', () => {
    const form = values({
      attendees: [{ ...emptyAttendee('Mateo'), kind: 'child', age: null }],
    });
    expect(schemaAdults.safeParse(form).success).toBe(true);
    expect(toRsvpInput(form, adultsOnly).attendees[0]).toMatchObject({ kind: 'adult', age: null });
  });
});
