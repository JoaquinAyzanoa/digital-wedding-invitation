import { describe, expect, it } from 'vitest';
import { photoFileName, photoZipName, thumbPath, zipParts } from './names';

const photo = {
  path: 'abc234/1a2b3c4d-1111-4111-8111-111111111111.webp',
  created_at: '2027-05-16T02:30:00Z', // 21:30 on the 15th in Lima
  invitation: { code: 'abc234', display_name: 'Familia López' },
};

describe('album names', () => {
  it('names photos by Lima date and time, in a folder per guest', () => {
    expect(photoFileName(photo)).toBe('2027-05-15_2130_1a2b3c.webp');
    expect(photoZipName(photo)).toBe('Familia-Lopez/2027-05-15_2130_1a2b3c.webp');
  });

  it('finds the thumbnail next to the photo', () => {
    expect(thumbPath(photo.path)).toBe('abc234/1a2b3c4d-1111-4111-8111-111111111111.thumb.webp');
  });

  it('splits the download into parts by size', () => {
    const photos = [400, 400, 400, 100, null].map((kb) => ({ bytes: kb && kb * 1024 }));
    const parts = zipParts(photos, 1000 * 1024);
    expect(parts.map((p) => p.length)).toEqual([2, 3]);
    // A single photo bigger than the limit still gets its own part.
    expect(zipParts([{ bytes: 5000 }], 1000).map((p) => p.length)).toEqual([1]);
  });
});
