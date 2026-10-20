import { AlbumUploader } from '@/invitation/album/AlbumUploader';
import { Reveal } from '@/invitation/components/Reveal';
import { useRsvpContext } from '@/invitation/rsvpContext';
import { Icon } from '@/shared/icons/Icon';
import { Section, SectionTitle } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

export function AlbumSection({ content, invitation, entry }: SectionProps) {
  const { api } = useRsvpContext();
  if (!content.album.enabled) return null;

  return (
    <Section content={content} entry={entry} labelledBy="album-title">
      <Reveal>
        <Icon name="album" size={84} className={text.primaryIcon} />
      </Reveal>
      <Reveal>
        <SectionTitle id="album-title">{sectionTitle(content, 'album')}</SectionTitle>
      </Reveal>
      {content.album.text && (
        <Reveal>
          <p className={text.body}>{content.album.text}</p>
        </Reveal>
      )}
      {/* Uploading needs the guest's code, an open album and the Drive web app connected. */}
      {invitation?.albumOpen && invitation.albumUploadUrl && (
        <Reveal>
          <AlbumUploader api={api} uploadUrl={invitation.albumUploadUrl} code={invitation.code} />
        </Reveal>
      )}
    </Section>
  );
}
