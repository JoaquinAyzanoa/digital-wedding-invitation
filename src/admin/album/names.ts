// Pure helpers (no Supabase client): file names and the ZIP split.
import type { AlbumPhoto } from '@/admin/data/album';

/** `abc234/<uuid>.webp` → `abc234/<uuid>.thumb.webp` (uploaded next to every photo). */
export function thumbPath(path: string): string {
  return path.replace(/\.(\w+)$/, '.thumb.$1');
}

function slug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'invitado'
  );
}

/** "Familia-Lopez/2027-05-15_2130_1a2b3c.webp": by guest, in the order they were taken. */
export function photoZipName(photo: Pick<AlbumPhoto, 'path' | 'created_at' | 'invitation'>) {
  return `${slug(photo.invitation.display_name)}/${photoFileName(photo)}`;
}

/** "2027-05-15_2130_1a2b3c.webp" (Lima time, plus a piece of the id so names never clash). */
export function photoFileName(photo: Pick<AlbumPhoto, 'path' | 'created_at'>) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(photo.created_at))
      .map((p) => [p.type, p.value]),
  );
  const [, id = 'foto', ext = 'jpg'] = /\/([0-9a-f]{6})[^/]*\.(\w+)$/.exec(photo.path) ?? [];
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}${parts.minute}_${id}.${ext}`;
}

/** The download in parts of about this size: a phone cannot hold a 1 GB ZIP in memory. */
export const ZIP_PART_BYTES = 100 * 1024 * 1024;

/** Splits the photos into ZIP parts by their stored size (~500 KB when unknown). */
export function zipParts<T extends { bytes: number | null }>(photos: T[], limit = ZIP_PART_BYTES) {
  const parts: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const photo of photos) {
    const bytes = photo.bytes ?? 500 * 1024;
    if (current.length && size + bytes > limit) {
      parts.push(current);
      current = [];
      size = 0;
    }
    current.push(photo);
    size += bytes;
  }
  if (current.length) parts.push(current);
  return parts;
}
