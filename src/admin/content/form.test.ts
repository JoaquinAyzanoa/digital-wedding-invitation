import { describe, expect, it } from 'vitest';
import { demoContent, demoInvitation } from '@/demo/content';
import { contrastRatio } from '@/shared/theme/contrast';
import { contentFormSchema, sectionOfPath, toFormValues } from './form';

describe('content form', () => {
  it('fills the optional parts the editor always shows', () => {
    const { family, titles, music, ...rest } = demoContent;
    void family;
    void titles;
    void music;
    const values = toFormValues(rest as typeof demoContent, demoInvitation.private);
    expect(values.public.family).toEqual({ parents: { bride: [], groom: [] }, godparents: [] });
    expect(values.public.titles).toEqual({});
    expect(values.public.music).toEqual({ url: '', title: undefined });
  });

  it('saves an empty song as null and accepts the demo content', () => {
    const parsed = contentFormSchema.parse(toFormValues(demoContent, demoInvitation.private));
    expect(parsed.public.music).toBeNull();
    expect(parsed.public.couple.bride).toBe('Valeria');
  });

  it('keeps a song with its url', () => {
    const values = toFormValues(
      { ...demoContent, music: { url: 'https://x.co/song.mp3', title: 'Nuestra canción' } },
      demoInvitation.private,
    );
    expect(contentFormSchema.parse(values).public.music).toEqual({
      url: 'https://x.co/song.mp3',
      title: 'Nuestra canción',
    });
  });

  it('finds the editor section of an invalid field', () => {
    expect(sectionOfPath('public.events.1.time')).toBe('events');
    expect(sectionOfPath('public.couple.bride')).toBe('couple');
    expect(sectionOfPath('public.closingPhrase')).toBe('itinerary');
    expect(sectionOfPath('private.gifts.0.label')).toBe('gifts');
    expect(sectionOfPath('public.theme.colors.bg')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // The default ink on the default background is very readable.
    expect(contrastRatio('#2E2A3A', '#FBFAF7')).toBeGreaterThan(12);
  });
});
