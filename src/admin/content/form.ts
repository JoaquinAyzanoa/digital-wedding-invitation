import { z } from 'zod';
import {
  privateContentSchema,
  publicContentSchema,
  type PrivateContent,
  type PublicContent,
} from '@/shared/schemas/content';

/** The whole editable content: what guests see, and the payment details. */
export interface ContentForm {
  public: PublicContent;
  private: PrivateContent;
}

/** The editor keeps `music` as an object while editing; no song means `null`. */
function normalizePublic(value: unknown): unknown {
  const content = value as Partial<PublicContent> | null;
  if (!content || typeof content !== 'object') return value;
  return { ...content, music: content.music?.url ? content.music : null };
}

export const contentFormSchema = z.object({
  public: z.preprocess(normalizePublic, publicContentSchema),
  private: privateContentSchema,
});

/** Fills optional parts the editor always shows, so every field has a value to edit. */
export function toFormValues(content: PublicContent, privateContent: PrivateContent): ContentForm {
  return {
    public: {
      ...content,
      family: content.family ?? { parents: { bride: [], groom: [] }, godparents: [] },
      // Always an object while editing (the song fields bind to it); saving turns an
      // empty one into null.
      music: content.music ?? { url: '', title: undefined },
      titles: content.titles ?? {},
    },
    private: privateContent,
  };
}

/** Each accordion of the editor, and which top-level keys of the content live in it. */
export const CONTENT_SECTIONS = {
  couple: ['couple', 'date', 'dateIntro'],
  welcome: ['welcome', 'music'],
  photos: ['photos', 'decorations'],
  family: ['family'],
  events: ['events'],
  itinerary: ['itinerary', 'closingPhrase'],
  gifts: ['gifts', 'private'],
  dressCode: ['dressCode'],
  rsvp: ['rsvp'],
  album: ['album', 'farewell'],
  sections: ['sections', 'titles'],
  whatsapp: ['whatsapp'],
} as const;

export type ContentSectionKey = keyof typeof CONTENT_SECTIONS;

/** The editor section that contains a field path such as `public.events.1.time`. */
export function sectionOfPath(path: string): ContentSectionKey | null {
  const [root, key] = path.split('.');
  const lookup = root === 'private' ? 'private' : key;
  for (const [section, keys] of Object.entries(CONTENT_SECTIONS)) {
    if ((keys as readonly string[]).includes(lookup ?? '')) return section as ContentSectionKey;
  }
  return null;
}
