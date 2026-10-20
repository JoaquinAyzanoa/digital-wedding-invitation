import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FontRef, PublicContent } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import { applyTheme } from '@/shared/theme/theme';
import { AudioProvider } from './audio/AudioProvider';
import { useAudio } from './audio/audioContext';
import { MuteButton } from './audio/MuteButton';
import { DesignPanel } from './components/DesignPanel/DesignPanel';
import { Envelope } from './components/Envelope/Envelope';
import { Petals } from './components/Petals/Petals';
import { RevealContext } from './components/revealContext';
import styles from './Invitation.module.css';
import { SECTION_COMPONENTS } from './sections/registry';
import { ToastProvider } from './toast/ToastProvider';
import type { CodeStatus } from './useInvitationData';

interface InvitationProps {
  content: PublicContent;
  invitation: InvitationView | null;
  codeStatus: CodeStatus;
  showDesignPanel: boolean;
}

export function Invitation(props: InvitationProps) {
  return (
    <MotionConfig reducedMotion="user">
      <AudioProvider src={props.content.music?.url ?? null}>
        <ToastProvider>
          <InvitationPage {...props} />
        </ToastProvider>
      </AudioProvider>
    </MotionConfig>
  );
}

function InvitationPage({ content, invitation, codeStatus, showDesignPanel }: InvitationProps) {
  const audio = useAudio();
  const hasEnvelope = content.sections.some((s) => s.id === 'envelope' && s.visible);
  const [envelopeOpen, setEnvelopeOpen] = useState(!hasEnvelope);
  const [petals, setPetals] = useState(false);
  const hidePetals = useCallback(() => setPetals(false), []);
  const [scriptFont, setScriptFont] = useState<FontRef>(content.theme.fonts.script);
  const [fontsReady, setFontsReady] = useState(false);

  const theme = useMemo(
    () => ({ ...content.theme, fonts: { ...content.theme.fonts, script: scriptFont } }),
    [content.theme, scriptFont],
  );

  useEffect(() => {
    let active = true;
    void applyTheme(theme, content.customFonts).then(() => {
      if (active) setFontsReady(true);
    });
    return () => {
      active = false;
    };
  }, [theme, content.customFonts]);

  useEffect(() => {
    document.title = `${content.couple.bride} & ${content.couple.groom} · Nuestra boda`;
    // Warm the cache for the first photo while the guest looks at the envelope.
    if (content.photos.hero) new Image().src = content.photos.hero;
  }, [content]);

  const sections = content.sections.filter((s) => s.visible && s.id !== 'envelope');

  return (
    <>
      <RevealContext value={envelopeOpen}>
        <main className={styles.page} aria-hidden={!envelopeOpen}>
          {sections.map((entry, i) => {
            const Component = SECTION_COMPONENTS[entry.id as Exclude<typeof entry.id, 'envelope'>];
            return (
              <Component
                key={`${entry.id}-${i}`}
                content={content}
                invitation={invitation}
                entry={entry}
              />
            );
          })}
        </main>
      </RevealContext>

      {!envelopeOpen && (
        <Envelope
          content={content}
          invitation={invitation}
          codeNotFound={codeStatus === 'not_found'}
          ready={fontsReady}
          onOpen={() => {
            audio.play();
            setPetals(true);
          }}
          onOpened={() => setEnvelopeOpen(true)}
        />
      )}

      {petals && <Petals onDone={hidePetals} />}
      {envelopeOpen && <MuteButton />}

      {showDesignPanel && (
        <DesignPanel
          sample={`${content.couple.bride} & ${content.couple.groom}`}
          value={scriptFont}
          onChange={setScriptFont}
        />
      )}
    </>
  );
}
