import type { ComponentType } from 'react';
import type { SectionId } from '@/shared/schemas/content';
import { AlbumSection } from './AlbumSection';
import { ClosingSection } from './ClosingSection';
import { DateSection } from './DateSection/DateSection';
import { DressCodeSection } from './DressCodeSection';
import { EventsSection } from './EventsSection';
import { FamilySection } from './FamilySection';
import { FarewellSection } from './FarewellSection';
import { GiftsSection } from './GiftsSection';
import { ItinerarySection } from './ItinerarySection';
import { PhotoSection } from './PhotoSection';
import { RsvpSection } from './RsvpSection';
import type { SectionProps } from './types';
import { WelcomeSection } from './WelcomeSection';

/** Page sections in `content.sections`. The envelope is an overlay, rendered separately. */
export const SECTION_COMPONENTS: Record<
  Exclude<SectionId, 'envelope'>,
  ComponentType<SectionProps>
> = {
  welcome: WelcomeSection,
  photo: PhotoSection,
  family: FamilySection,
  date: DateSection,
  events: EventsSection,
  itinerary: ItinerarySection,
  closing: ClosingSection,
  gifts: GiftsSection,
  dressCode: DressCodeSection,
  album: AlbumSection,
  rsvp: RsvpSection,
  farewell: FarewellSection,
};
