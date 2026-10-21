import { useAnimate, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { coverPoster, type PublicContent } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import { datePartsInLima } from '@/shared/utils/date';
import { CodeEntry } from '../CodeEntry/CodeEntry';
import { Countdown } from '../Countdown/Countdown';
import { CardFace } from './CardFace';
import styles from './Envelope.module.css';
import { Back, FlapFront, FlapInside, PaperDefs, Pocket } from './paper';
import { paperIds } from './paperIds';
import { WaxSeal } from './WaxSeal';

const OPENED_KEY = 'wi-envelope-opened';
// The full sequence takes ~3.5 s; past this, open anyway (e.g. animation frames paused).
const SAFETY_TIMEOUT_MS = 6000;

function readOpenedBefore() {
  try {
    return localStorage.getItem(OPENED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberOpened() {
  try {
    localStorage.setItem(OPENED_KEY, '1');
  } catch {
    // Private mode or blocked storage: the skip button just won't show next time.
  }
}

interface EnvelopeProps {
  content: Pick<PublicContent, 'couple' | 'date' | 'decorations' | 'coverVideo'>;
  invitation: Pick<InvitationView, 'displayName' | 'seats'> | null;
  /** The link had a code that does not exist: offer to type it again. */
  codeNotFound?: boolean;
  /** Fonts are loaded: fade the content in. */
  ready: boolean;
  /** Called synchronously on the tap, so audio can start inside the user gesture. */
  onOpen?: () => void;
  /** Called when the envelope is gone. */
  onOpened: () => void;
}

export function Envelope({
  content,
  invitation,
  codeNotFound = false,
  ready,
  onOpen,
  onOpened,
}: EnvelopeProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const [opening, setOpening] = useState(false);
  const [canSkip] = useState(readOpenedBefore);
  const titleId = useId();
  const ids = paperIds(titleId);

  const { bride, groom, monogram } = content.couple;
  const video = content.coverVideo;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Phones only autoplay muted video, and React does not always set the muted attribute in
  // time: set it here and start it (Low Power Mode may still refuse: the poster stays).
  useEffect(() => {
    const element = videoRef.current;
    if (!element || reducedMotion) return;
    element.muted = true;
    element.defaultMuted = true;
    // Older browsers return nothing from play(), and some throw instead of rejecting.
    Promise.resolve()
      .then(() => element.play())
      .catch(() => {});
  }, [video, reducedMotion]);
  const date = datePartsInLima(content.date);
  const { day, month, year } = date;

  // Keep the page behind from scrolling while the envelope covers it.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  async function open(skip = false) {
    if (opening) return;
    setOpening(true);
    onOpen?.();
    rememberOpened();
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, SAFETY_TIMEOUT_MS));
    try {
      await Promise.race([play(skip || !!reducedMotion), timeout]);
    } finally {
      // Never leave the guest stuck behind the envelope, even if an animation fails or stalls.
      onOpened();
    }
  }

  async function play(fadeOnly: boolean) {
    const root = scope.current;
    if (fadeOnly) {
      await animate(root, { opacity: 0 }, { duration: 0.5 });
      return;
    }

    const flap = root.querySelector<HTMLElement>('[data-flap]')!;
    // The seal is not broken: it answers the tap with a soft press and a warm glow, then stays
    // on the flap and rises with it, as real wax does.
    await Promise.all([
      animate(
        '[data-seal-whole]',
        { scale: [1, 0.9, 1.05, 1] },
        { duration: 0.6, ease: 'easeInOut', times: [0, 0.3, 0.7, 1] },
      ),
      animate(
        '[data-seal-glow]',
        { opacity: [0, 0.9, 0], scale: [0.6, 1.2, 1.5] },
        { duration: 0.8, ease: 'easeOut' },
      ),
      animate('[data-hint]', { opacity: 0 }, { duration: 0.3 }),
      // The open flap rises over the text above the envelope: clear the stage first.
      animate('[data-fade-on-open]', { opacity: 0 }, { duration: 0.4 }),
    ]);
    await animate(flap, { rotateX: 90 }, { duration: 0.4, ease: 'easeIn' });
    // Past 90° the flap is behind the card and we see its inside.
    flap.dataset.open = 'true';
    await animate(flap, { rotateX: 180 }, { duration: 0.35, ease: 'easeOut' });
    await animate('[data-card]', { y: '-62%' }, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    // A moment to see the card before the page appears.
    await animate(root, { opacity: 0, y: -24 }, { duration: 0.7, ease: 'easeInOut', delay: 0.55 });
  }

  const seats = invitation?.seats ?? 0;

  return (
    <div
      ref={scope}
      className={styles.overlay}
      data-video={Boolean(video)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {video && (
        <>
          {/* Wide screens: the video stands in a column over a blurred copy of its frame. */}
          <span
            className={styles.backdrop}
            style={{ backgroundImage: `url("${coverPoster(video)}")` }}
            aria-hidden="true"
          />
          <video
            ref={videoRef}
            className={styles.video}
            src={video}
            poster={coverPoster(video)}
            muted
            loop
            playsInline
            autoPlay={!reducedMotion}
            preload="auto"
            aria-hidden="true"
          />
          <span className={styles.veil} aria-hidden="true" />
        </>
      )}
      {!video && content.decorations.cornerTL && (
        <img
          className={`${styles.decoration} ${styles.decorationTop}`}
          src={content.decorations.cornerTL}
          alt=""
        />
      )}
      {!video && content.decorations.cornerBR && (
        <img
          className={`${styles.decoration} ${styles.decorationBottom}`}
          src={content.decorations.cornerBR}
          alt=""
        />
      )}

      <PaperDefs ids={ids} />

      {canSkip && (
        <button type="button" className={styles.skip} onClick={() => open(true)}>
          Saltar
        </button>
      )}

      <div className={styles.content} data-ready={ready}>
        <p className={styles.kicker} data-fade-on-open>
          {video ? 'Te invitamos a nuestra boda' : '¡Nos casamos!'}
        </p>
        <h1 id={titleId} className={styles.names} data-fade-on-open>
          {bride} <span className={styles.amp}>&amp;</span> {groom}
        </h1>
        <p className={styles.date} data-fade-on-open>
          {day} <span aria-hidden="true">.</span> {month} <span aria-hidden="true">.</span> {year}
        </p>

        <button
          type="button"
          className={styles.envelope}
          onClick={() => open()}
          disabled={opening}
          aria-label="Abrir la invitación"
        >
          <Back ids={ids} />
          <span className={styles.card} data-card>
            <CardFace ids={ids} monogram={monogram} bride={bride} groom={groom} date={date} />
          </span>
          <Pocket ids={ids} />
          <span className={styles.flap} data-flap>
            <FlapFront ids={ids} />
            <FlapInside ids={ids} />
            <span className={styles.hint} aria-hidden="true" data-hint>
              Clic para abrir
            </span>
            <span className={styles.seal}>
              <span className={styles.sealGlow} data-seal-glow />
              <span className={styles.sealWhole} data-seal-whole>
                <WaxSeal monogram={monogram} shine={!opening} />
              </span>
            </span>
          </span>
        </button>

        {invitation && video && (
          <div className={styles.reservedCover} data-fade-on-open>
            <p className={styles.guest}>{invitation.displayName}</p>
            <p className={styles.reservedLine}>
              Hemos reservado <strong>{seats}</strong>{' '}
              {seats === 1 ? 'lugar en su honor' : 'lugares en su honor'}
            </p>
          </div>
        )}

        {invitation && !video && (
          <div className={styles.reserved} data-fade-on-open>
            <p className={styles.guest}>{invitation.displayName}</p>
            <p className={styles.reservedText}>Hemos reservado</p>
            <p className={styles.seats}>{seats}</p>
            <p className={styles.reservedText}>
              {seats === 1 ? 'lugar en su honor' : 'lugares en su honor'}
            </p>
          </div>
        )}

        {video && (
          <div className={styles.countdown} data-fade-on-open>
            <Countdown target={content.date} variant="cover" />
          </div>
        )}

        {codeNotFound && (
          <div className={styles.notFound} data-fade-on-open>
            <p>No encontramos tu invitación.</p>
            <CodeEntry message="Revisa el código al final de tu enlace e ingrésalo aquí:" />
          </div>
        )}
      </div>
    </div>
  );
}
