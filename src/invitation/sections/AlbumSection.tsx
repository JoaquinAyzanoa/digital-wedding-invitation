import { Reveal } from '@/invitation/components/Reveal';
import { useToast } from '@/shared/toast/toastContext';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { Section, SectionTitle } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

export function AlbumSection({ content, invitation, entry }: SectionProps) {
  const toast = useToast();
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
      {/* Uploading needs the guest's code and an open album (dates in the content). */}
      {invitation?.albumOpen && (
        <Reveal>
          {/* Phase 9: compression and upload to the `album` bucket. */}
          <Button onClick={() => toast('Muy pronto podrás subir tus fotos')}>
            Clic para subir fotos
          </Button>
        </Reveal>
      )}
    </Section>
  );
}
