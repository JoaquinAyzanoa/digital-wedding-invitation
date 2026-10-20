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

// Only http(s): content URLs end up in href/src, and `javascript:` is a valid URL.
const httpUrl = z.url({ protocol: /^https?$/, error: 'Debe ser un enlace https://' });
const webAppUrl = z
  .string()
  .regex(
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/,
    'La URL de la aplicación web: https://script.google.com/macros/s/…/exec',
  );
const driveFolderUrl = z
  .string()
  .regex(
    /^https:\/\/drive\.google\.com\/[A-Za-z0-9/_?=&.-]+$/,
    'Un enlace de Google Drive: https://drive.google.com/…',
  );
// Font names and ids are written into CSS (font-family, @font-face): no quotes or braces.
const fontFamily = z.string().regex(/^[A-Za-z0-9 ]{1,60}$/, 'Solo letras, números y espacios');
const fontId = z.string().regex(/^[a-z0-9-]{1,40}$/, 'Solo minúsculas, números y guiones');

// A bare date (YYYY-MM-DD, read in America/Lima) or an ISO datetime with offset.
const dateOrDateTime = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const fontRefSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('google'), family: fontFamily }),
  z.object({ source: z.literal('custom'), id: fontId }),
]);

export type FontRef = z.infer<typeof fontRefSchema>;

export const customFontSchema = z.object({
  id: fontId,
  family: requiredText(60),
  url: httpUrl,
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
    .object({ url: httpUrl, title: text(80).optional() })
    .nullable()
    .optional(),
  photos: z.record(z.enum(PHOTO_SLOTS), httpUrl.nullable()),
  decorations: z.object({
    cornerTL: httpUrl.optional(),
    cornerBR: httpUrl.optional(),
    side: httpUrl.optional(),
  }),
  family: z
    .object({
      parents: z.object({ bride: z.array(requiredText(80)), groom: z.array(requiredText(80)) }),
      godparents: z.array(requiredText(80)),
      intro: text(200).optional(),
      godparentsIntro: text(200).optional(),
    })
    .optional(),
  events: z.array(
    z.object({
      kind: z.enum(['ceremony', 'reception']),
      title: requiredText(40),
      time,
      venue: requiredText(120),
      address: text(200),
      mapsUrl: httpUrl.optional(),
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
    /** Shown once the RSVP has closed (e.g. how to reach the couple). */
    closedText: text(300).optional(),
    menuOptions: z.array(requiredText(60)),
    questions: z.object({
      transport: z.boolean(),
      lodging: z.boolean(),
      song: z.boolean(),
      parts: z.boolean(),
      /** DNI of each person (8 digits, required). Missing in older content: on. */
      dni: z.boolean().default(true),
      /** Children at the wedding (asks adult or child, and the age). Missing: no. */
      children: z.boolean().default(false),
    }),
  }),
  album: z.object({
    enabled: z.boolean(),
    opensAt: dateOrDateTime,
    closesAt: dateOrDateTime,
    text: text(500),
    /** The Apps Script web app that saves the photos in Google Drive. */
    uploadUrl: webAppUrl.optional(),
    /** The Drive folder with the photos (shown in the admin). */
    folderUrl: driveFolderUrl.optional(),
  }),
  farewell: text(200),
  sections: z.array(
    z.object({
      id: z.enum(SECTION_IDS),
      visible: z.boolean(),
      photo: z.enum(PHOTO_SLOTS).optional(),
      /** Watercolor flowers (`decorations.side`) at the top of the section, on this side. */
      decor: z.enum(['left', 'right']).optional(),
    }),
  ),
  /** Script titles of the sections; missing ones use the defaults in the invitation. */
  titles: z.partialRecord(z.enum(SECTION_IDS), text(60)).optional(),
  theme: themeSchema,
  customFonts: z.array(customFontSchema),
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
