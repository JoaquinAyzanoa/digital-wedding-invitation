import { AlbumUploader } from '@/invitation/album/AlbumUploader';
import { Reveal } from '@/invitation/components/Reveal';
import { useRsvpContext } from '@/invitation/rsvpContext';
import { isAlbumOpen } from '@/shared/utils/album';
import { Icon } from '@/shared/icons/Icon';
import { Section, SectionTitle } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

export function AlbumSection({ content, invitation, entry }: SectionProps) {
  const { api } = useRsvpContext();
  // The guest's invitation says it (server time); without a code, the content's dates.
  const open = invitation ? invitation.albumOpen : isAlbumOpen(content.album);
  if (!content.album.enabled) return null;

  return (
    <Section content={content} entry={entry} labelledBy="album-title">
      <Reveal>
        <Icon name="album" size={84} className={text.goldIcon} />
      </Reveal>
      <Reveal>
        <SectionTitle id="album-title">{sectionTitle(content, 'album')}</SectionTitle>
      </Reveal>
      {content.album.text && (
        <Reveal>
          <p className={text.body}>{content.album.text}</p>
        </Reveal>
      )}
      {/* Anyone can upload while the album is open (no code needed: the QR on the tables
          leads to /fotos/ with the same uploader). */}
      {open && content.album.uploadUrl && (
        <Reveal>
          <AlbumUploader api={api} uploadUrl={content.album.uploadUrl} />
        </Reveal>
      )}
    </Section>
  );
}
