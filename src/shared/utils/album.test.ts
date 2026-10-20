import { describe, expect, it } from 'vitest';
import { isAlbumOpen, limaInstant } from './album';

const album = {
  enabled: true,
  opensAt: '2027-05-15',
  closesAt: '2027-06-15',
  text: '',
  uploadUrl: 'https://script.google.com/macros/s/x/exec',
};

describe('album dates', () => {
  it('reads bare dates as days in Lima', () => {
    expect(limaInstant('2027-05-15').toISOString()).toBe('2027-05-15T05:00:00.000Z');
    expect(limaInstant('2027-06-15', true).toISOString()).toBe('2027-06-16T05:00:00.000Z');
    expect(limaInstant('2027-05-15T18:00:00-05:00').toISOString()).toBe('2027-05-15T23:00:00.000Z');
  });

  it('is open from the start of the first day to the end of the last one (Lima)', () => {
    expect(isAlbumOpen(album, new Date('2027-05-15T04:59:00Z'))).toBe(false);
    expect(isAlbumOpen(album, new Date('2027-05-15T05:00:00Z'))).toBe(true);
    expect(isAlbumOpen(album, new Date('2027-06-16T04:59:00Z'))).toBe(true);
    expect(isAlbumOpen(album, new Date('2027-06-16T05:00:00Z'))).toBe(false);
  });

  it('is closed when disabled or not connected to Drive', () => {
    const now = new Date('2027-05-20T12:00:00Z');
    expect(isAlbumOpen({ ...album, enabled: false }, now)).toBe(false);
    expect(isAlbumOpen({ ...album, uploadUrl: undefined }, now)).toBe(false);
  });
});
