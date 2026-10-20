import { describe, expect, it } from 'vitest';
import { createDemoApi } from './demoApi';
import { toApiError } from './supabaseApi';
import { ApiError } from './types';

describe('toApiError', () => {
  it('maps codes raised by the RPCs', () => {
    expect(toApiError({ message: 'rsvp_closed', code: 'P0001' }).code).toBe('rsvp_closed');
    expect(toApiError({ message: 'invalid_attendees', code: 'P0001' }).code).toBe(
      'invalid_attendees',
    );
  });

  it('detects network failures', () => {
    expect(toApiError({ message: 'TypeError: Failed to fetch', code: '' }).code).toBe('network');
  });

  it('falls back to unknown', () => {
    expect(toApiError({ message: 'permission denied for table x', code: '42501' }).code).toBe(
      'unknown',
    );
  });
});

describe('demo api', () => {
  it('only knows the demo code', async () => {
    const api = createDemoApi();
    expect(await api.getInvitation('DEMO ')).not.toBeNull();
    expect(await api.getInvitation('abc234')).toBeNull();
  });

  it('stores an rsvp in memory', async () => {
    const api = createDemoApi();
    const view = await api.submitRsvp('demo', {
      attending: true,
      attendees: [{ fullName: ' Ana ', kind: 'adult', age: null, menu: 'Carne', dietary: '' }],
      songRequest: 'Una canción',
    });
    expect(view.response?.attendees).toEqual([
      { fullName: 'Ana', kind: 'adult', age: null, menu: 'Carne', dietary: null, dniHint: null },
    ]);
    expect((await api.getInvitation('demo'))?.response?.songRequest).toBe('Una canción');
  });

  it('rejects more attendees than seats', async () => {
    const api = createDemoApi();
    const attendee = {
      fullName: 'A',
      kind: 'adult' as const,
      age: null,
      menu: null,
      dietary: null,
    };
    await expect(
      api.submitRsvp('demo', { attending: true, attendees: [attendee, attendee, attendee] }),
    ).rejects.toEqual(new ApiError('invalid_attendees'));
  });
});
