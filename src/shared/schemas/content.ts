import { z } from 'zod';

export const SECTION_IDS = [
  'envelope',
  'welcome',
  'photo',
  'family',
  'date',
  'events',
  'itinerary',
  'closing',
  'gifts',
  'dressCode',
  'album',
  'rsvp',
  'farewell',
] as const;

export const PHOTO_SLOTS = ['hero', 'divider1', 'divider2', 'divider3', 'closing'] as const;

export const ICON_KEYS = [
  'church',
  'arch',
  'couple',
  'rings',
  'glasses',
  'plate',
  'confetti',
  'gift',
  'album',
  'camera',
  'calendar',
  'dress',
  'suit',
  'heart',
  'infinity',
  'location',
  'music',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];
export type IconKey = (typeof ICON_KEYS)[number];

const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number) => text(max).min(1);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal, p. ej. #4F6496');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora en formato 24 h, p. ej. 15:30');

// A bare date (YYYY-MM-DD, read in America/Lima) or an ISO datetime with offset.
const dateOrDateTime = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const fontRefSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('google'), family: requiredText(60) }),
  z.object({ source: z.literal('custom'), id: requiredText(40) }),
]);

export type FontRef = z.infer<typeof fontRefSchema>;

export const customFontSchema = z.object({
  id: requiredText(40),
  family: requiredText(60),
  url: z.url(),
});

export type CustomFont = z.infer<typeof customFontSchema>;

export const themeSchema = z.object({
  colors: z.object({
    bg: hexColor,
    surface: hexColor,
    ink: hexColor,
    muted: hexColor,
    primary: hexColor,
    accent: hexColor,
    line: hexColor,
  }),
  fonts: z.object({
    script: fontRefSchema,
    serif: fontRefSchema,
    sans: fontRefSchema,
  }),
});

export type Theme = z.infer<typeof themeSchema>;
export type ThemeColor = keyof Theme['colors'];

export const publicContentSchema = z.object({
  couple: z.object({
    bride: requiredText(40),
    groom: requiredText(40),
    monogram: requiredText(8),
  }),
  date: z.iso.datetime({ offset: true }),
  timezone: z.literal('America/Lima'),
  welcome: z.object({ text: text(1000), quote: text(300).optional() }),
  dateIntro: text(300),
  music: z
    .object({ url: z.url(), title: text(80).optional() })
    .nullable()
    .optional(),
  photos: z.record(z.enum(PHOTO_SLOTS), z.url().nullable()),
  decorations: z.object({
    cornerTL: z.url().optional(),
    cornerBR: z.url().optional(),
    side: z.url().optional(),
  }),
  family: z
    .object({
      parents: z.object({ bride: z.array(requiredText(80)), groom: z.array(requiredText(80)) }),
      godparents: z.array(requiredText(80)),
    })
    .optional(),
  events: z.array(
    z.object({
      kind: z.enum(['ceremony', 'reception']),
      title: requiredText(40),
      time,
      venue: requiredText(120),
      address: text(200),
      mapsUrl: z.url().optional(),
      intro: text(200).optional(),
    }),
  ),
  itinerary: z.array(z.object({ time, label: requiredText(60), icon: z.enum(ICON_KEYS) })),
  closingPhrase: text(120),
  dressCode: z.object({ title: text(60), notes: z.array(requiredText(160)) }),
  gifts: z.object({ text: text(500) }),
  rsvp: z.object({
    deadline: dateOrDateTime,
    closed: z.boolean(),
    intro: text(500),
    menuOptions: z.array(requiredText(60)),
    questions: z.object({
      transport: z.boolean(),
      lodging: z.boolean(),
      song: z.boolean(),
      parts: z.boolean(),
    }),
  }),
  album: z.object({
    enabled: z.boolean(),
    opensAt: dateOrDateTime,
    closesAt: dateOrDateTime,
    text: text(500),
  }),
  farewell: text(200),
  sections: z.array(
    z.object({
      id: z.enum(SECTION_IDS),
      visible: z.boolean(),
      photo: z.enum(PHOTO_SLOTS).optional(),
    }),
  ),
  theme: themeSchema,
  customFonts: z.array(customFontSchema),
  whatsapp: z.object({ inviteTemplate: text(1000), reminderTemplate: text(1000) }),
});

export type PublicContent = z.infer<typeof publicContentSchema>;

export const privateContentSchema = z.object({
  gifts: z.array(
    z.object({
      label: requiredText(60),
      lines: z.array(requiredText(120)),
      copy: text(60).optional(),
    }),
  ),
});

export type PrivateContent = z.infer<typeof privateContentSchema>;
