import type { DateParts } from '@/shared/utils/date';
import styles from './Envelope.module.css';
import type { PaperIds } from './paperIds';

// The card inside the envelope (viewBox 264 × 176, the envelope's 3:2): an embossed arch
// panel with sprigs at its shoulders, the monogram in a cartouche, the names and the date.

const ARCH = 'M62 176V66C62 34 94 17 132 17C170 17 202 34 202 66V176';
const ARCH_INNER = 'M67 176V67C67 39 97 22 132 22C167 22 197 39 197 67V176';

/** A sprig: a curved stem with leaves, growing from (0, 0) towards the upper right. */
const SPRIG_STEM = 'M0 0C6 -6 14 -10 26 -11';
const SPRIG_LEAVES = [
  [7, -4.6, -62],
  [11.5, -7.2, 28],
  [16, -9, -55],
  [20.5, -10.2, 30],
  [25.5, -11, -20],
] as const;
const LEAF = 'M0 0Q2.4 -2 5.4 0Q2.4 2 0 0Z';

function Sprig({ transform }: { transform: string }) {
  return (
    <g transform={transform}>
      <path d={SPRIG_STEM} fill="none" strokeWidth="0.6" className={styles.cardLine} />
      {SPRIG_LEAVES.map(([x, y, angle]) => (
        <path
          key={`${x}`}
          d={LEAF}
          transform={`translate(${x} ${y}) rotate(${angle})`}
          className={styles.cardFill}
        />
      ))}
      <circle cx="28" cy="-11" r="1" className={styles.cardFill} />
    </g>
  );
}

/** An embossed line: a light copy under it, offset towards the light. */
function Embossed({ d, width = 0.7 }: { d: string; width?: number }) {
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.9"
        strokeWidth={width}
        transform="translate(0.7 0.7)"
      />
      <path d={d} fill="none" strokeWidth={width} className={styles.cardLine} />
    </>
  );
}

export function Cartouche({ monogram }: { monogram: string }) {
  const fontSize = monogram.length <= 3 ? 15 : monogram.length <= 5 ? 12 : 9;
  return (
    <svg className={styles.cartouche} viewBox="-30 -36 60 72" aria-hidden="true">
      <g fill="none" className={styles.cardLine}>
        <ellipse rx="16.5" ry="20.5" strokeWidth="0.8" />
        <ellipse rx="19" ry="23.5" strokeWidth="0.45" />
        {/* Crest, side curls and a pair of leaves underneath */}
        <path d="M-9 -24.5C-6 -31 -2 -32 0 -28C2 -32 6 -31 9 -24.5" strokeWidth="0.7" />
        <path d="M-19 -7C-24 -5 -24 5 -19 7M19 -7C24 -5 24 5 19 7" strokeWidth="0.6" />
      </g>
      <g className={styles.cardFill}>
        <circle cy="-31.5" r="1.3" />
        <circle cx="-22.5" r="0.9" />
        <circle cx="22.5" r="0.9" />
        <path d="M0 24C-4 27.5 -9.5 27.5 -13 24C-8.5 22.6 -4 22.8 0 24Z" />
        <path d="M0 24C4 27.5 9.5 27.5 13 24C8.5 22.6 4 22.8 0 24Z" />
        <circle cy="27" r="1.1" />
      </g>
      <text className={styles.cartoucheText} fontSize={fontSize} y="1">
        {monogram}
      </text>
    </svg>
  );
}

interface CardFaceProps {
  ids: PaperIds;
  monogram: string;
  bride: string;
  groom: string;
  date: DateParts;
}

export function CardFace({ ids, monogram, bride, groom, date }: CardFaceProps) {
  return (
    <>
      <svg
        className={styles.cardArt}
        viewBox="0 0 264 176"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          width="264"
          height="176"
          rx="2.5"
          className={styles.cardPaper}
          filter={`url(#${ids.grain})`}
        />
        {/* Gilded edges, like a fine printed card */}
        <rect
          x="0.6"
          y="0.6"
          width="262.8"
          height="174.8"
          rx="2.2"
          fill="none"
          strokeWidth="1.2"
          className={styles.gilt}
        />
        <rect
          x="6.5"
          y="6.5"
          width="251"
          height="163"
          rx="1.5"
          fill="none"
          strokeWidth="0.5"
          className={styles.cardLine}
        />
        <rect
          x="9.5"
          y="9.5"
          width="245"
          height="157"
          fill="none"
          strokeWidth="0.3"
          className={styles.cardLine}
        />
        <Embossed d={ARCH} width={0.8} />
        <Embossed d={ARCH_INNER} width={0.45} />
        <Sprig transform="translate(22 50)" />
        <Sprig transform="translate(242 50) scale(-1 1)" />
        <Sprig transform="translate(22 132) scale(1 -1)" />
        <Sprig transform="translate(242 132) scale(-1 -1)" />
      </svg>
      <span className={styles.cardText}>
        <Cartouche monogram={monogram} />
        <span className={styles.cardNames}>
          {bride} <span className={styles.cardAmp}>&amp;</span> {groom}
        </span>
        <span className={styles.cardDate}>
          <span className={styles.cardDateSide}>{date.weekday}</span>
          <span className={styles.cardDay}>{date.day}</span>
          <span className={styles.cardDateSide}>{date.month}</span>
        </span>
        <span className={styles.cardYear}>{date.year}</span>
        <svg className={styles.cardDivider} viewBox="0 0 80 8" aria-hidden="true">
          <path d="M2 4H31M49 4H78" fill="none" strokeWidth="0.5" className={styles.cardLine} />
          <path d="M40 0.6L43.4 4 40 7.4 36.6 4Z" className={styles.cardFill} />
          <circle cx="33.5" cy="4" r="0.9" className={styles.cardFill} />
          <circle cx="46.5" cy="4" r="0.9" className={styles.cardFill} />
        </svg>
      </span>
    </>
  );
}
