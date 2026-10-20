import { useCallback, useState } from 'react';
import { CodeEntry } from '@/invitation/components/CodeEntry/CodeEntry';
import { Confetti } from '@/invitation/components/Confetti/Confetti';
import { Reveal } from '@/invitation/components/Reveal';
import { RsvpForm } from '@/invitation/rsvp/RsvpForm';
import { RsvpSummary } from '@/invitation/rsvp/RsvpSummary';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { dayMonthInLima } from '@/shared/utils/date';
import styles from './RsvpSection.module.css';
import { Section, SectionTitle } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

export function RsvpSection({ content, invitation, entry }: SectionProps) {
  const [editing, setEditing] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const stopCelebrating = useCallback(() => setCelebrate(false), []);
  const response = invitation?.response;

  function renderBody() {
    if (!invitation) {
      return <CodeEntry message="Ingresa el código de tu invitación para confirmar:" />;
    }

    if (editing && invitation.rsvpOpen) {
      return (
        <RsvpForm
          content={content}
          invitation={invitation}
          onCancel={response ? () => setEditing(false) : undefined}
          onDone={(attending) => {
            setEditing(false);
            setJustAnswered(true);
            if (attending) setCelebrate(true);
          }}
        />
      );
    }

    if (response) {
      return (
        <RsvpSummary
          content={content}
          invitation={{ ...invitation, response }}
          focusOnMount={justAnswered}
          onChange={() => {
            setJustAnswered(false);
            setEditing(true);
          }}
        />
      );
    }

    if (invitation.rsvpOpen) {
      return (
        <>
          <Button onClick={() => setEditing(true)}>Confirma aquí</Button>
          <p className={text.small}>Confirma antes del {dayMonthInLima(content.rsvp.deadline)}.</p>
        </>
      );
    }

    return (
      <p className={text.body}>
        {content.rsvp.closedText ||
          'La confirmación ya cerró. Si aún quieres confirmar, escríbenos.'}
      </p>
    );
  }

  return (
    <Section content={content} entry={entry} labelledBy="rsvp-title">
      <Reveal>
        <Icon name="calendar" size={84} className={text.primaryIcon} />
      </Reveal>
      <Reveal>
        <SectionTitle id="rsvp-title">{sectionTitle(content, 'rsvp')}</SectionTitle>
      </Reveal>
      {content.rsvp.intro && !editing && (
        <Reveal>
          <p className={text.body}>{content.rsvp.intro}</p>
        </Reveal>
      )}

      {/* Not wrapped in Reveal: a remount would reset the form. */}
      <div className={styles.body}>{renderBody()}</div>

      {celebrate && <Confetti onDone={stopCelebrating} />}
    </Section>
  );
}
