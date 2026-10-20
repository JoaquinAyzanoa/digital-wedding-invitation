import { describe, expect, it } from 'vitest';
import type { InvitationWithAttendees } from '@/shared/schemas/invitationAdmin';
import {
  applyFilters,
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  groupsOf,
  NO_GROUP,
} from './filters';

function invitation(overrides: Partial<InvitationWithAttendees>): InvitationWithAttendees {
  return {
    id: overrides.code ?? 'x',
    code: 'abc234',
    display_name: 'X',
    seats: 1,
    side: 'both',
    group_name: null,
    phone: null,
    email: null,
    notes: null,
    sent_at: null,
    first_opened_at: null,
    last_opened_at: null,
    open_count: 0,
    attending: null,
    attends_ceremony: null,
    attends_reception: null,
    needs_transport: null,
    needs_lodging: null,
    contact_phone: null,
    song_request: null,
    message: null,
    responded_at: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    attendees: [],
    ...overrides,
  };
}

const list = [
  invitation({
    code: 'aaa222',
    display_name: 'Familia Pérez',
    group_name: 'Familia',
    side: 'bride',
    seats: 4,
  }),
  invitation({
    code: 'bbb333',
    display_name: 'Ana y Luis',
    group_name: 'Amigos',
    side: 'groom',
    seats: 2,
    attending: true,
    sent_at: '2026-10-02T00:00:00Z',
    first_opened_at: '2026-10-03T00:00:00Z',
    responded_at: '2026-10-03T00:00:00Z',
    attendees: [
      {
        id: '1',
        invitation_id: 'bbb333',
        position: 1,
        full_name: 'Ana Torres',
        kind: 'adult',
        age: null,
        menu: null,
        dietary: null,
        dni: null,
      },
    ],
  }),
  invitation({
    code: 'ccc444',
    display_name: 'Carla',
    attending: false,
    created_at: '2026-10-05T00:00:00Z',
  }),
];

const codes = (filters: Partial<typeof DEFAULT_FILTERS>) =>
  applyFilters(list, { ...DEFAULT_FILTERS, ...filters }).map((i) => i.code);

describe('applyFilters', () => {
  it('sorts by name by default (Spanish order)', () => {
    expect(codes({})).toEqual(['bbb333', 'ccc444', 'aaa222']);
  });

  it('searches without accents, in attendees too, every word', () => {
    expect(codes({ q: 'perez' })).toEqual(['aaa222']);
    expect(codes({ q: 'torres' })).toEqual(['bbb333']);
    expect(codes({ q: 'ana amigos' })).toEqual(['bbb333']);
    expect(codes({ q: 'ana familia' })).toEqual([]);
  });

  it('filters by status, side, group, sent and opened', () => {
    expect(codes({ status: 'pending' })).toEqual(['aaa222']);
    expect(codes({ status: 'declined' })).toEqual(['ccc444']);
    expect(codes({ side: 'groom' })).toEqual(['bbb333']);
    expect(codes({ group: 'Familia' })).toEqual(['aaa222']);
    expect(codes({ group: NO_GROUP })).toEqual(['ccc444']);
    expect(codes({ sent: 'no' })).toEqual(['ccc444', 'aaa222']);
    expect(codes({ opened: 'yes' })).toEqual(['bbb333']);
  });

  it('sorts by seats, creation and response date', () => {
    expect(codes({ sort: 'seats' })).toEqual(['aaa222', 'bbb333', 'ccc444']);
    expect(codes({ sort: 'created' })[0]).toBe('ccc444');
    expect(codes({ sort: 'responded' })[0]).toBe('bbb333');
  });
});

describe('URL params', () => {
  it('round-trips and omits defaults', () => {
    const filters = { ...DEFAULT_FILTERS, q: 'ana', status: 'pending' as const };
    const params = filtersToParams(filters);
    expect(params.toString()).toBe('q=ana&status=pending');
    expect(filtersFromParams(params)).toEqual(filters);
  });

  it('ignores invalid values', () => {
    expect(filtersFromParams(new URLSearchParams('status=maybe&sort=x'))).toEqual(DEFAULT_FILTERS);
  });
});

it('lists the groups in use', () => {
  expect(groupsOf(list)).toEqual(['Amigos', 'Familia']);
});
