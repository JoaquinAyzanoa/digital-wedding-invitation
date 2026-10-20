import { DownloadPdfButton } from '@/invitation/components/DownloadPdfButton';
import { Reveal } from '@/invitation/components/Reveal';
import { Section } from './Section';
import text from './text.module.css';
import type { SectionProps } from './types';

export function FarewellSection({ content, invitation, entry }: SectionProps) {
  if (!content.farewell && !invitation) return null;
  return (
    <Section content={content} entry={entry}>
      {content.farewell && (
        <Reveal>
          <p className={text.upper} style={{ maxWidth: '22ch', fontSize: 21 }}>
            {content.farewell}
          </p>
        </Reveal>
      )}
      {/* Only with a code: the PDF carries the guest's name, seats and personal QR. */}
      {invitation && (
        <Reveal>
          <DownloadPdfButton content={content} invitation={invitation} />
        </Reveal>
      )}
    </Section>
  );
}
