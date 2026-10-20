import type { PublicContent, SectionId } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';

export type SectionEntry = PublicContent['sections'][number];

export interface SectionProps {
  content: PublicContent;
  /** Null without a code or with an unknown one. */
  invitation: InvitationView | null;
  entry: SectionEntry;
}

const DEFAULT_TITLES: Partial<Record<SectionId, string>> = {
  itinerary: 'Itinerario de actividades',
  gifts: 'Gracias',
  dressCode: 'Dress code',
  album: 'Álbum de recuerdos',
  rsvp: 'Confirmar asistencia',
};

export function sectionTitle(content: PublicContent, id: SectionId): string {
  return content.titles?.[id] || DEFAULT_TITLES[id] || '';
}
