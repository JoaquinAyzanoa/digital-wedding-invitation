import { useAnimate, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState } from 'react';
import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import { datePartsInLima } from '@/shared/utils/date';
import { CodeEntry } from '../CodeEntry/CodeEntry';
import styles from './Envelope.module.css';
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
  content: Pick<PublicContent, 'couple' | 'date' | 'decorations'>;
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
  const arcId = `${titleId.replace(/[^a-zA-Z0-9_-]/g, '')}-arc`;

  const { bride, groom, monogram } = content.couple;
  const { day, month, year } = datePartsInLima(content.date);

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
    await Promise.all([
      animate('[data-seal-whole]', { opacity: 0 }, { duration: 0.01 }),
      animate(
        '[data-seal-half="left"]',
        { opacity: [1, 1, 0], x: -16, y: 34, rotate: -24 },
        { duration: 0.7, ease: 'easeIn' },
      ),
      animate(
        '[data-seal-half="right"]',
        { opacity: [1, 1, 0], x: 16, y: 34, rotate: 24 },
        { duration: 0.7, ease: 'easeIn' },
      ),
      animate('[data-hint]', { opacity: 0 }, { duration: 0.3 }),
      // The open flap rises over the text above the envelope: clear the stage first.
      animate('[data-fade-on-open]', { opacity: 0 }, { duration: 0.4 }),
    ]);
    await animate(flap, { rotateX: 90 }, { duration: 0.35, ease: 'easeIn' });
    // Past 90° the flap is behind the card and we see its inside.
    flap.dataset.open = 'true';
    await animate(flap, { rotateX: 180 }, { duration: 0.35, ease: 'easeOut' });
    await animate('[data-card]', { y: '-58%' }, { duration: 0.8, ease: [0.22, 1, 0.36, 1] });
    await animate(root, { opacity: 0, y: -24 }, { duration: 0.7, ease: 'easeInOut', delay: 0.25 });
  }

  const seats = invitation?.seats ?? 0;

  return (
    <div
      ref={scope}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {content.decorations.cornerTL && (
        <img
          className={`${styles.decoration} ${styles.decorationTop}`}
          src={content.decorations.cornerTL}
          alt=""
        />
      )}
      {content.decorations.cornerBR && (
        <img
          className={`${styles.decoration} ${styles.decorationBottom}`}
          src={content.decorations.cornerBR}
          alt=""
        />
      )}

      {canSkip && (
        <button type="button" className={styles.skip} onClick={() => open(true)}>
          Saltar
        </button>
      )}

      <div className={styles.content} data-ready={ready}>
        <p className={styles.kicker} data-fade-on-open>
          ¡Nos casamos!
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
          <span className={styles.back} />
          <span className={styles.card} data-card>
            <span className={styles.cardMonogram}>{monogram}</span>
          </span>
          <svg
            className={styles.pocket}
            viewBox="0 0 300 200"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path className={styles.side} d="M0 0 140 106 0 200Z" />
            <path className={styles.side} d="M300 0 160 106 300 200Z" />
            <path className={styles.bottom} d="M0 200 136 99Q150 89 164 99L300 200Z" />
          </svg>
          <span className={styles.flap} data-flap>
            <svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 0H300L162 109Q150 118 138 109Z" />
            </svg>
          </span>
          <span className={styles.seal}>
            <span className={styles.sealWhole} data-seal-whole>
              <WaxSeal monogram={monogram} shine={!opening} />
            </span>
            <span className={styles.sealHalf} data-seal-half="left">
              <WaxSeal monogram={monogram} half="left" />
            </span>
            <span className={styles.sealHalf} data-seal-half="right">
              <WaxSeal monogram={monogram} half="right" />
            </span>
            <svg className={styles.hint} viewBox="-22 -22 164 164" aria-hidden="true" data-hint>
              <path id={arcId} d="M-4 60A64 64 0 0 0 124 60" fill="none" />
              <text>
                <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
                  Clic aquí para abrir
                </textPath>
              </text>
            </svg>
          </span>
        </button>

        {invitation && (
          <div className={styles.reserved} data-fade-on-open>
            <p className={styles.guest}>{invitation.displayName}</p>
            <p className={styles.reservedText}>Hemos reservado</p>
            <p className={styles.seats}>{seats}</p>
            <p className={styles.reservedText}>
              {seats === 1 ? 'lugar en su honor' : 'lugares en su honor'}
            </p>
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
