import { MotionConfig } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicApi } from '@/shared/api';
import type { FontRef, PublicContent } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import { applyTheme } from '@/shared/theme/theme';
import { AudioProvider } from './audio/AudioProvider';
import { useAudioActions } from './audio/audioContext';
import { MuteButton } from './audio/MuteButton';
import { DesignPanel } from './components/DesignPanel/DesignPanel';
import { Envelope } from './components/Envelope/Envelope';
import { Petals } from './components/Petals/Petals';
import { RevealContext } from './components/revealContext';
import styles from './Invitation.module.css';
import { RsvpContext } from './rsvpContext';
import { PaperEdgeContext } from './sections/paperEdgeContext';
import { SECTION_COMPONENTS } from './sections/registry';
import { ToastProvider } from '@/shared/toast/ToastProvider';
import type { CodeStatus } from './useInvitationData';

interface InvitationProps {
  api: PublicApi;
  content: PublicContent;
  invitation: InvitationView | null;
  codeStatus: CodeStatus;
  showDesignPanel: boolean;
  /** Start the song as the page opens (not in the admin's preview). */
  autoplayMusic?: boolean;
}

export function Invitation(props: InvitationProps) {
  return (
    <MotionConfig reducedMotion="user">
      <AudioProvider src={props.content.music?.url ?? null} autoplay={props.autoplayMusic}>
        <ToastProvider>
          <InvitationPage {...props} />
        </ToastProvider>
      </AudioProvider>
    </MotionConfig>
  );
}

function InvitationPage({
  api,
  content,
  invitation: initialInvitation,
  codeStatus,
  showDesignPanel,
}: InvitationProps) {
  const audio = useAudioActions();
  // Replaced when the guest answers the RSVP (or the server reports it closed).
  const [invitation, setInvitation] = useState(initialInvitation);
  const rsvp = useMemo(() => ({ api, onInvitationChange: setInvitation }), [api]);
  const hasEnvelope = content.sections.some((s) => s.id === 'envelope' && s.visible);
  const [envelopeOpen, setEnvelopeOpen] = useState(!hasEnvelope);
  // Petals start straight on the element: no re-render of the page during the tap.
  const petalsRef = useRef<HTMLDivElement>(null);
  // The ?design=1 panel's pick overrides the content's font; without a pick, content changes
  // (the admin's live preview) always show.
  const [scriptOverride, setScriptOverride] = useState<FontRef | null>(null);
  const scriptFont = scriptOverride ?? content.theme.fonts.script;
  const [fontsReady, setFontsReady] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

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
      <RsvpContext value={rsvp}>
        <RevealContext value={envelopeOpen}>
          <main ref={mainRef} className={styles.page} aria-hidden={!envelopeOpen} tabIndex={-1}>
            {/* The envelope's heading disappears with it: keep one for screen readers. */}
            <h1 className="visually-hidden">
              Invitación a la boda de {content.couple.bride} y {content.couple.groom}
            </h1>
            {sections.map((entry, i) => {
              const Component =
                SECTION_COMPONENTS[entry.id as Exclude<typeof entry.id, 'envelope'>];
              const paperEdge = i === 0 || sections[i - 1]?.id === 'photo';
              return (
                <PaperEdgeContext key={`${entry.id}-${i}`} value={paperEdge}>
                  <Component content={content} invitation={invitation} entry={entry} />
                </PaperEdgeContext>
              );
            })}
          </main>
        </RevealContext>
      </RsvpContext>

      {!envelopeOpen && (
        <Envelope
          content={content}
          invitation={invitation}
          codeNotFound={codeStatus === 'not_found'}
          ready={fontsReady}
          onOpen={() => {
            // Usually already playing; if not, the tap starts it.
            void audio.start();
            if (petalsRef.current) petalsRef.current.dataset.falling = 'true';
          }}
          onOpened={() => {
            setEnvelopeOpen(true);
            // The focused envelope button is gone: continue from the top of the page.
            requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
          }}
        />
      )}

      {hasEnvelope && <Petals ref={petalsRef} cover={Boolean(content.coverVideo)} />}
      <MuteButton overEnvelope={!envelopeOpen} />

      {showDesignPanel && (
        <DesignPanel
          sample={`${content.couple.bride} & ${content.couple.groom}`}
          value={scriptFont}
          onChange={setScriptOverride}
        />
      )}
    </>
  );
}
