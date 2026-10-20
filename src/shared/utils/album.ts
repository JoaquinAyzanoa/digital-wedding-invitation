import type { PublicContent } from '@/shared/schemas/content';

/**
 * A content date as an instant, like private.lima_instant in the database: a bare date is a
 * day in Lima (UTC−5 all year, no daylight saving), from its start or, with `endOfDay`, until
 * its end. A datetime with offset is taken as it is.
 */
export function limaInstant(value: string, endOfDay = false): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);
  const start = new Date(`${value}T00:00:00-05:00`);
  return endOfDay ? new Date(start.getTime() + 24 * 3600 * 1000) : start;
}

/** Whether guests may upload photos now: enabled, within its dates and connected to Drive. */
export function isAlbumOpen(album: PublicContent['album'], now = new Date()): boolean {
  return (
    album.enabled &&
    Boolean(album.uploadUrl) &&
    now >= limaInstant(album.opensAt) &&
    now < limaInstant(album.closesAt, true)
  );
}
