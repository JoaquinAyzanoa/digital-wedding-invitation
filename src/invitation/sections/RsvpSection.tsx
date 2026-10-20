import { CodeEntry } from '@/invitation/components/CodeEntry/CodeEntry';
import { Reveal } from '@/invitation/components/Reveal';
import { useToast } from '@/invitation/toast/toastContext';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { datePartsInLima } from '@/shared/utils/date';
import styles from './RsvpSection.module.css';
import { Section, SectionTitle } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

/** "15 de abril" from a date or datetime deadline. */
function deadlineLabel(deadline: string) {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? `${deadline}T12:00:00-05:00` : deadline;
  const { day, month } = datePartsInLima(iso);
  return `${day} de ${month}`;
}

export function RsvpSection({ content, invitation, entry }: SectionProps) {
  const toast = useToast();
  const response = invitation?.response;

  return (
    <Section content={content} entry={entry} labelledBy="rsvp-title">
      <Reveal>
        <Icon name="calendar" size={84} className={text.primaryIcon} />
      </Reveal>
      <Reveal>
        <SectionTitle id="rsvp-title">{sectionTitle(content, 'rsvp')}</SectionTitle>
      </Reveal>
      {content.rsvp.intro && (
        <Reveal>
          <p className={text.body}>{content.rsvp.intro}</p>
        </Reveal>
      )}

      <Reveal className={styles.body}>
        {!invitation && <CodeEntry message="Ingresa el código de tu invitación para confirmar:" />}

        {invitation && response && (
          <div className={styles.summary}>
            <p className={text.upper}>
              {response.attending ? '¡Gracias por confirmar!' : 'Gracias por avisarnos'}
            </p>
            {response.attending && (
              <ul className={styles.attendees}>
                {response.attendees.map((attendee, i) => (
                  <li key={i}>{attendee.fullName}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {invitation && invitation.rsvpOpen && (
          <>
            {/* Phase 4: the multi-step form. */}
            <Button onClick={() => toast('Muy pronto podrás confirmar aquí')}>
              {response ? 'Cambiar mi respuesta' : 'Confirma aquí'}
            </Button>
            <p className={text.small}>Confirma antes del {deadlineLabel(content.rsvp.deadline)}.</p>
          </>
        )}

        {invitation && !invitation.rsvpOpen && (
          <p className={text.small}>
            La confirmación ya cerró. Si necesitas cambiar algo, escríbenos.
          </p>
        )}
      </Reveal>
    </Section>
  );
}
